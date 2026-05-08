import { createEffect, createSignal, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { cache, createAsync, redirect, useParams, A } from "@solidjs/router";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { getDb } from "~/db";
import { problems, translations } from "~/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSiteDisplayName, normalizeProblemId } from "~/lib/problems";
import { renderMarkdown } from "~/lib/markdown";
import { useI18n } from "~/lib/i18n";

type PageData =
  | {
      status: "ok";
      site: string;
      externalProblemId: string;
      translationId: number;
      existingContent: string;
    }
  | { status: "no_translation" }
  | { status: "problem_not_found" }
  | { status: "invalid_params" }
  | { status: "server_error" };

const getEditTranslationData = cache(
  async (site: string, externalProblemId: string): Promise<PageData> => {
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
    if (!getSiteDisplayName(normalizedSite) || !normalizedId) {
      return { status: "invalid_params" };
    }

    if (site !== normalizedSite || externalProblemId !== normalizedId) {
      throw redirect(`/problems/${normalizedSite}/${normalizedId}/edit-translation`, 301);
    }

    const db = getDb(env.DB as never);

    // Find the problem row.
    const problem = await db
      .select({ id: problems.id })
      .from(problems)
      .where(
        and(
          eq(problems.site, normalizedSite),
          eq(problems.externalProblemId, normalizedId)
        )
      )
      .get();

    if (!problem) {
      return { status: "problem_not_found" };
    }

    // Find the user's existing active translation.
    const translation = await db
      .select({ id: translations.id, content: translations.content })
      .from(translations)
      .where(
        and(
          eq(translations.problemId, problem.id),
          eq(translations.authorId, session.dbUserId!),
          eq(translations.status, "active"),
          isNull(translations.deletedAt)
        )
      )
      .get();

    if (!translation) {
      return { status: "no_translation" };
    }

    return {
      status: "ok",
      site: normalizedSite,
      externalProblemId: normalizedId,
      translationId: translation.id,
      existingContent: translation.content,
    };
  },
  "getEditTranslationData"
);

export const route = {
  load: ({ params }: { params: { site: string; externalProblemId: string } }) =>
    getEditTranslationData(params.site, params.externalProblemId),
};

export default function EditTranslationPage() {
  const params = useParams<{ site: string; externalProblemId: string }>();
  const data = createAsync(() =>
    getEditTranslationData(params.site, params.externalProblemId)
  );
  const { t } = useI18n();

  const displayName = () => getSiteDisplayName(params.site) ?? params.site;
  const heading = () =>
    `${displayName()}/${params.externalProblemId} - ${t("editTranslationSuffix")}`;

  const [content, setContent] = createSignal("");
  const [initializedTranslationId, setInitializedTranslationId] = createSignal<number | null>(null);
  const [previewHtml, setPreviewHtml] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string | null>(null);
  const [submitted, setSubmitted] = createSignal(false);

  // Pre-fill the textarea with the existing content whenever a different
  // translation is loaded, while avoiding overwriting edits for the same one.
  createEffect(() => {
    const d = data();
    if (d?.status === "ok" && initializedTranslationId() !== d.translationId) {
      setContent(d.existingContent);
      setInitializedTranslationId(d.translationId);
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
      setSubmitError(t("translationContentEmpty"));
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/translations/${d.translationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(
          (body as { error?: string }).error ?? t("failedToUpdateTranslation")
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
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-yellow-700 mb-2">{t("invalidProblem")}</h1>
          <p class="text-yellow-600">{t("invalidProblemDesc")}</p>
        </div>
      </Show>

      <Show when={data()?.status === "server_error"}>
        <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-red-700 mb-2">{t("serverError")}</h1>
          <p class="text-red-600">{t("serverErrorDesc")}</p>
        </div>
      </Show>

      <Show when={data()?.status === "no_translation" || data()?.status === "problem_not_found"}>
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-yellow-700 mb-2">{t("noTranslationFound")}</h1>
          <p class="text-yellow-600 mb-4">
            {t("noTranslationFoundDesc")}
          </p>
          <A
            href={`/problems/${params.site}/${params.externalProblemId}/add-translation`}
            class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {t("addTranslation")}
          </A>
        </div>
      </Show>

      <Show when={data()?.status === "ok"}>
        <Show
          when={!submitted()}
          fallback={
            <div class="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <h1 class="text-2xl font-bold text-green-700 mb-2">{t("translationUpdated")}</h1>
              <p class="text-green-600 mb-4">{t("translationSaved")}</p>
              <A
                href={`/problems/${params.site}/${params.externalProblemId}`}
                class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {t("backToProblem")}
              </A>
            </div>
          }
        >
          <h1 class="text-2xl font-bold text-gray-900 mb-6">{heading()}</h1>

          <div class="flex flex-col gap-6">
            {/* Editor */}
            <div>
              <label
                for="translation-content"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("translationEditorLabel")}
              </label>
              <textarea
                id="translation-content"
                rows={16}
                value={content()}
                onInput={(e) => setContent(e.currentTarget.value)}
                placeholder={t("translationEditorPlaceholder")}
                class="w-full border border-gray-400 bg-white rounded-lg px-4 py-3 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>

            {/* Action buttons */}
            <div class="flex gap-3">
              <button
                type="button"
                onClick={updatePreview}
                class="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {t("updatePreview")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting()}
                class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {submitting() ? t("savingEllipsis") : t("save")}
              </button>
            </div>

            <Show when={submitError()}>
              <p class="text-sm text-red-600">{submitError()}</p>
            </Show>

            {/* Preview */}
            <Show when={previewHtml() !== null}>
              <div>
                <h2 class="text-lg font-semibold text-gray-800 mb-2">{t("preview")}</h2>
                <div
                  class="border border-gray-200 rounded-xl p-6 bg-white shadow-sm markdown-content"
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
