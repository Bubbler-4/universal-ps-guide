import { createEffect, createSignal, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { cache, createAsync, redirect, useParams, A } from "@solidjs/router";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { getDb } from "~/db";
import { problems, solutions } from "~/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSiteDisplayName, normalizeProblemId } from "~/lib/problems";
import { renderMarkdown } from "~/lib/markdown";
import { useI18n } from "~/lib/i18n";

type PageData =
  | {
      status: "ok";
      site: string;
      externalProblemId: string;
      solutionId: number;
      existingContent: string;
      updatedAt: string;
    }
  | { status: "no_solution" }
  | { status: "problem_not_found" }
  | { status: "invalid_params" }
  | { status: "server_error" };

const getEditSolutionData = cache(
  async (
    site: string,
    externalProblemId: string,
    solutionId: string
  ): Promise<PageData> => {
    "use server";

    const event = getRequestEvent();
    if (!event) return { status: "server_error" };

    const env = getCloudflareEnv(event);
    if (!env.DB) return { status: "server_error" };

    const session = await getServerSession(event.request, env);
    if (!session) {
      throw redirect(`/login`);
    }
    if (session.needsUsername) {
      throw redirect(`/setup-username`);
    }
    if (!session.dbUserId) {
      return { status: "server_error" };
    }

    const normalizedSite = site.trim().toLowerCase();
    const normalizedId = normalizeProblemId(externalProblemId);
    const parsedSolutionId = Number(solutionId);
    if (
      !getSiteDisplayName(normalizedSite) ||
      !normalizedId ||
      !Number.isInteger(parsedSolutionId) ||
      parsedSolutionId <= 0
    ) {
      return { status: "invalid_params" };
    }

    if (site !== normalizedSite || externalProblemId !== normalizedId) {
      throw redirect(
        `/problems/${normalizedSite}/${normalizedId}/edit-solution/${parsedSolutionId}`,
        301
      );
    }

    const db = getDb(env.DB as never);

    const problem = await db
      .select({ id: problems.id })
      .from(problems)
      .where(
        and(eq(problems.site, normalizedSite), eq(problems.externalProblemId, normalizedId))
      )
      .get();

    if (!problem) {
      return { status: "problem_not_found" };
    }

    const solution = await db
      .select({
        id: solutions.id,
        content: solutions.content,
        updatedAt: solutions.updatedAt,
      })
      .from(solutions)
      .where(
        and(
          eq(solutions.id, parsedSolutionId),
          eq(solutions.problemId, problem.id),
          eq(solutions.authorId, session.dbUserId),
          eq(solutions.status, "active"),
          isNull(solutions.deletedAt)
        )
      )
      .get();

    if (!solution) {
      return { status: "no_solution" };
    }

    return {
      status: "ok",
      site: normalizedSite,
      externalProblemId: normalizedId,
      solutionId: solution.id,
      existingContent: solution.content,
      updatedAt: solution.updatedAt,
    };
  },
  "getEditSolutionData"
);

export const route = {
  load: ({
    params,
  }: {
    params: { site: string; externalProblemId: string; solutionId: string };
  }) => getEditSolutionData(params.site, params.externalProblemId, params.solutionId),
};

export default function EditSolutionPage() {
  const params = useParams<{
    site: string;
    externalProblemId: string;
    solutionId: string;
  }>();
  const data = createAsync(() =>
    getEditSolutionData(params.site, params.externalProblemId, params.solutionId)
  );
  const { t } = useI18n();

  const displayName = () => getSiteDisplayName(params.site) ?? params.site;
  const heading = () => `${displayName()}/${params.externalProblemId} - ${t("editSolutionSuffix")}`;

  const [content, setContent] = createSignal("");
  const [initializedSolutionId, setInitializedSolutionId] = createSignal<number | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = createSignal("");
  const [previewHtml, setPreviewHtml] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string | null>(null);
  const [submitted, setSubmitted] = createSignal(false);

  createEffect(() => {
    const d = data();
    if (d?.status === "ok" && initializedSolutionId() !== d.solutionId) {
      setContent(d.existingContent);
      setLoadedUpdatedAt(d.updatedAt);
      setInitializedSolutionId(d.solutionId);
    }
  });

  const updatePreview = () => {
    setPreviewHtml(renderMarkdown(content()));
  };

  const handleSubmit = async () => {
    const d = data();
    if (d?.status !== "ok") return;

    const trimmed = content().trim();
    if (!trimmed) {
      setSubmitError(t("solutionContentEmpty"));
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
        const res = await fetch(`/api/solutions/${d.solutionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed, updatedAt: loadedUpdatedAt() }),
        });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(
          (body as { error?: string }).error ?? t("failedToUpdateSolution")
        );
      } else {
        setSubmitted(true);
      }
    } catch {
      setSubmitError(t("networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main class="mx-auto max-w-5xl px-4 py-12">
      <Show when={data()?.status === "invalid_params"}>
        <div class="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-yellow-700 dark:text-yellow-300 mb-2">{t("invalidProblem")}</h1>
          <p class="text-yellow-600 dark:text-yellow-400">{t("invalidProblemWithSolutionDesc")}</p>
        </div>
      </Show>

      <Show when={data()?.status === "server_error"}>
        <div class="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">{t("serverError")}</h1>
          <p class="text-red-600 dark:text-red-400">{t("serverErrorDesc")}</p>
        </div>
      </Show>

      <Show when={data()?.status === "no_solution" || data()?.status === "problem_not_found"}>
        <div class="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-yellow-700 dark:text-yellow-300 mb-2">{t("noSolutionFound")}</h1>
          <p class="text-yellow-600 dark:text-yellow-400 mb-4">{t("noSolutionFoundDesc")}</p>
          <A
            href={`/problems/${params.site}/${params.externalProblemId}/add-solution`}
            class="inline-block bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 text-white font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {t("addSolution")}
          </A>
        </div>
      </Show>

      <Show when={data()?.status === "ok"}>
        <Show
          when={!submitted()}
          fallback={
            <div class="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
              <h1 class="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">{t("solutionUpdated")}</h1>
              <p class="text-green-600 dark:text-green-400 mb-4">{t("solutionSaved")}</p>
              <A
                href={`/problems/${params.site}/${params.externalProblemId}`}
                class="inline-block bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 text-white font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {t("backToProblem")}
              </A>
            </div>
          }
        >
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">{heading()}</h1>

          <div class="flex flex-col gap-6">
            <div>
              <label for="solution-content" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("solutionEditorLabel")}
              </label>
              <textarea
                id="solution-content"
                rows={16}
                value={content()}
                onInput={(e) => setContent(e.currentTarget.value)}
                placeholder={t("solutionEditorPlaceholder")}
                class="w-full border border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-lg px-4 py-3 font-mono text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-y"
              />
            </div>

            <div class="flex gap-3">
              <button
                type="button"
                onClick={updatePreview}
                class="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {t("updatePreview")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting()}
                class="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {submitting() ? t("savingEllipsis") : t("save")}
              </button>
            </div>

            <Show when={submitError()}>
              <p class="text-sm text-red-600 dark:text-red-400">{submitError()}</p>
            </Show>

            <Show when={previewHtml() !== null}>
              <div>
                <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{t("preview")}</h2>
                <div
                  class="border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-900 shadow-sm dark:shadow-none markdown-content"
                  innerHTML={previewHtml()!}
                />
              </div>
            </Show>
          </div>
        </Show>
      </Show>
    </main>
  );
}
