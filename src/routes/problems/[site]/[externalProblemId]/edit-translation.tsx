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

type PageData =
  | {
      status: "ok";
      site: string;
      externalProblemId: string;
      translationId: number;
      existingContent: string;
    }
  | { status: "no_translation" }
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
      return { status: "no_translation" };
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

  const displayName = () => getSiteDisplayName(params.site) ?? params.site;
  const heading = () =>
    `${displayName()}/${params.externalProblemId} - Edit translation`;

  const [content, setContent] = createSignal("");
  const [initialized, setInitialized] = createSignal(false);
  const [previewHtml, setPreviewHtml] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string | null>(null);
  const [submitted, setSubmitted] = createSignal(false);

  // Pre-fill the textarea with the existing content once data loads.
  createEffect(() => {
    const d = data();
    if (d?.status === "ok" && !initialized()) {
      setContent(d.existingContent);
      setInitialized(true);
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
      setSubmitError("Translation content cannot be empty.");
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
          (body as { error?: string }).error ??
            "Failed to update translation. Please check your connection and try again."
        );
      } else {
        setSubmitted(true);
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main class="mx-auto max-w-5xl px-4 py-12">
      <Show when={data()?.status === "invalid_params"}>
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-yellow-700 mb-2">Invalid Problem</h1>
          <p class="text-yellow-600">The site or problem ID is not valid.</p>
        </div>
      </Show>

      <Show when={data()?.status === "server_error"}>
        <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-red-700 mb-2">Server Error</h1>
          <p class="text-red-600">Something went wrong on our end. Please try again later.</p>
        </div>
      </Show>

      <Show when={data()?.status === "no_translation"}>
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-yellow-700 mb-2">No Translation Found</h1>
          <p class="text-yellow-600 mb-4">
            You don't have an existing translation for this problem.
          </p>
          <A
            href={`/problems/${params.site}/${params.externalProblemId}/add-translation`}
            class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Add translation
          </A>
        </div>
      </Show>

      <Show when={data()?.status === "ok"}>
        <Show
          when={!submitted()}
          fallback={
            <div class="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <h1 class="text-2xl font-bold text-green-700 mb-2">Translation updated!</h1>
              <p class="text-green-600 mb-4">Your translation has been saved successfully.</p>
              <A
                href={`/problems/${params.site}/${params.externalProblemId}`}
                class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors"
              >
                Back to problem
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
                Translation (CommonMark, no HTML, KaTeX math supported)
              </label>
              <textarea
                id="translation-content"
                rows={16}
                value={content()}
                onInput={(e) => setContent(e.currentTarget.value)}
                placeholder="Write your translation here. Use $...$ for inline math and $$...$$ for block math."
                class="w-full border border-gray-300 rounded-lg px-4 py-3 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>

            {/* Action buttons */}
            <div class="flex gap-3">
              <button
                type="button"
                onClick={updatePreview}
                class="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-5 py-2 rounded-lg transition-colors"
              >
                Update preview
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting()}
                class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {submitting() ? "Saving…" : "Save"}
              </button>
            </div>

            <Show when={submitError()}>
              <p class="text-sm text-red-600">{submitError()}</p>
            </Show>

            {/* Preview */}
            <Show when={previewHtml() !== null}>
              <div>
                <h2 class="text-lg font-semibold text-gray-800 mb-2">Preview</h2>
                <div
                  class="border border-gray-200 rounded-xl p-6 bg-white shadow-sm prose max-w-none"
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
