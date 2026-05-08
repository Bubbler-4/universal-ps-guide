import { createEffect, createSignal, For, Show, Switch, Match } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { cache, createAsync, redirect, revalidate, useParams, A } from "@solidjs/router";
import { eq, and, isNull, asc } from "drizzle-orm";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { getDb } from "~/db";
import { problems, solutions, translations, users } from "~/db/schema";
import { getSiteDisplayName, normalizeProblemId } from "~/lib/problems";
import { renderMarkdown } from "~/lib/markdown";
import { MAX_VISIBLE_SOLUTIONS } from "~/lib/solutions";
import { useI18n } from "~/lib/i18n";

type TranslationWithAuthor = {
  id: number;
  authorId: number;
  authorUsername: string | null;
  content: string;
  contentHtml: string;
  createdAt: string;
};

type SolutionWithAuthor = {
  id: number;
  authorId: number;
  authorUsername: string | null;
  content: string;
  contentHtml: string;
  createdAt: string;
};

type ProblemResult =
  | {
      status: "found";
      site: string;
      externalProblemId: string;
      externalProblemLink: string;
      isLoggedIn: boolean;
      currentUserDbId: number | null;
      translations: TranslationWithAuthor[];
      solutions: SolutionWithAuthor[];
      solutionsTruncated: boolean;
    }
  | { status: "not_found" }
  | { status: "invalid_params" }
  | { status: "server_error" };

const getProblemData = cache(
  async (site: string, externalProblemId: string): Promise<ProblemResult> => {
    "use server";

    // Validate and normalize params server-side.
    const normalizedSite = site.trim().toLowerCase();
    const normalizedId = normalizeProblemId(externalProblemId);
    if (!getSiteDisplayName(normalizedSite) || !normalizedId) {
      return { status: "invalid_params" };
    }

    // Redirect to canonical URL if the params weren't already normalized.
    if (site !== normalizedSite || externalProblemId !== normalizedId) {
      throw redirect(`/problems/${normalizedSite}/${normalizedId}`, 301);
    }

    const event = getRequestEvent();
    if (!event) return { status: "server_error" };

    const env = getCloudflareEnv(event);
    if (!env.DB) return { status: "server_error" };

    const db = getDb(env.DB as never);
    const session = await getServerSession(event.request, env);
    const isLoggedIn = !!(session && !session.needsUsername);
    const currentUserDbId = isLoggedIn ? (session?.dbUserId ?? null) : null;

    const existing = await db
      .select()
      .from(problems)
      .where(and(eq(problems.site, normalizedSite), eq(problems.externalProblemId, normalizedId)))
      .get();

    if (!existing) {
      return { status: "not_found" };
    }

    const problem = existing;

    // Fetch active translations with author usernames.
    const rows = await db
      .select({
        id: translations.id,
        authorId: translations.authorId,
        authorUsername: users.username,
        content: translations.content,
        createdAt: translations.createdAt,
      })
      .from(translations)
      .leftJoin(users, eq(users.id, translations.authorId))
      .where(
        and(
          eq(translations.problemId, problem.id),
          eq(translations.status, "active"),
          isNull(translations.deletedAt)
        )
      )
      .orderBy(asc(translations.createdAt))
      .all();

    const translationList: TranslationWithAuthor[] = rows.map((row) => ({
      id: row.id,
      authorId: row.authorId,
      authorUsername: row.authorUsername ?? null,
      content: row.content,
      contentHtml: renderMarkdown(row.content),
      createdAt: row.createdAt,
    }));

    // Each problem is expected to have only a small number of solutions, so we
    // skip full pagination here and use limit + 1 / slice to detect overflow.
    const solutionRows = await db
      .select({
        id: solutions.id,
        authorId: solutions.authorId,
        authorUsername: users.username,
        content: solutions.content,
        createdAt: solutions.createdAt,
      })
      .from(solutions)
      .leftJoin(users, eq(users.id, solutions.authorId))
      .where(
        and(
          eq(solutions.problemId, problem.id),
          eq(solutions.status, "active"),
          isNull(solutions.deletedAt)
        )
      )
      .orderBy(asc(solutions.createdAt))
      .limit(MAX_VISIBLE_SOLUTIONS + 1)
      .all();

    const solutionsTruncated = solutionRows.length > MAX_VISIBLE_SOLUTIONS;

    const solutionList: SolutionWithAuthor[] = solutionRows
      .slice(0, MAX_VISIBLE_SOLUTIONS)
      .map((row) => ({
        id: row.id,
        authorId: row.authorId,
        authorUsername: row.authorUsername ?? null,
        content: row.content,
        contentHtml: renderMarkdown(row.content),
        createdAt: row.createdAt,
      }));

    return {
      status: "found",
      site: problem.site,
      externalProblemId: problem.externalProblemId,
      externalProblemLink: problem.externalProblemLink,
      isLoggedIn,
      currentUserDbId,
      translations: translationList,
      solutions: solutionList,
      solutionsTruncated,
    };
  },
  "getProblemData"
);

export const route = {
  load: ({ params }: { params: { site: string; externalProblemId: string } }) =>
    getProblemData(params.site, params.externalProblemId),
};

export default function ProblemPage() {
  const params = useParams<{ site: string; externalProblemId: string }>();
  const data = createAsync(() => getProblemData(params.site, params.externalProblemId));
  const { t, tf } = useI18n();

  const displayName = () => getSiteDisplayName(params.site) ?? params.site;
  const heading = () => `${displayName()}/${params.externalProblemId}`;

  const foundData = () => {
    const d = data();
    return d?.status === "found" ? d : null;
  };

  // Track selected translation index. Reset to 0 when translations change
  // (e.g. client-side navigation between problems).
  const [selectedIdx, setSelectedIdx] = createSignal(0);
  const selectedTranslation = () => foundData()?.translations[selectedIdx()];

  // True when the currently selected translation belongs to the logged-in user.
  const selectedIsOwned = () => {
    const tr = selectedTranslation();
    const uid = foundData()?.currentUserDbId;
    return !!(uid && tr && tr.authorId === uid);
  };

  // True when the logged-in user already has a translation in the list.
  const userOwnsATranslation = () => {
    const uid = foundData()?.currentUserDbId;
    return !!(uid && foundData()?.translations.some((tr) => tr.authorId === uid));
  };

  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  const [deleting, setDeleting] = createSignal(false);
  const [deletingSolutionId, setDeletingSolutionId] = createSignal<number | null>(null);
  const [solutionDeleteError, setSolutionDeleteError] = createSignal<{
    id: number;
    message: string;
  } | null>(null);

  const handleDelete = async () => {
    const translation = selectedTranslation();
    if (!translation) return;
    if (!window.confirm(t("confirmDeleteTranslation"))) return;

    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/translations/${translation.id}`, { method: "DELETE" });
      if (res.ok) {
        await revalidate(getProblemData.key);
      } else {
        const body = await res.json().catch(() => ({}));
        setDeleteError(
          (body as { error?: string }).error ?? t("failedToDeleteTranslation")
        );
      }
    } catch {
      setDeleteError(t("networkError"));
    } finally {
      setDeleting(false);
    }
  };

  const handleSolutionDelete = async (solutionId: number) => {
    if (!window.confirm(t("confirmDeleteSolution"))) return;

    setSolutionDeleteError(null);
    setDeletingSolutionId(solutionId);
    try {
      const res = await fetch(`/api/solutions/${solutionId}`, { method: "DELETE" });
      if (res.ok) {
        await revalidate(getProblemData.key);
      } else {
        const body = await res.json().catch(() => ({}));
        setSolutionDeleteError({
          id: solutionId,
          message:
            (body as { error?: string }).error ?? t("failedToDeleteSolution"),
        });
      }
    } catch {
      setSolutionDeleteError({
        id: solutionId,
        message: t("networkError"),
      });
    } finally {
      setDeletingSolutionId(null);
    }
  };

  createEffect(() => {
    const translationsArr = foundData()?.translations;
    const idx = selectedIdx();

    if (!translationsArr?.length) {
      if (idx !== 0) setSelectedIdx(0);
      return;
    }

    if (idx >= translationsArr.length) {
      setSelectedIdx(0);
    }
  });

  createEffect(() => {
    const d = data();
    if (d?.status === "found") {
      document.title = heading();
    }
  });

  return (
    <main class="mx-auto max-w-5xl px-4 py-12">
      <Switch fallback={<p class="text-gray-500">{t("loading")}</p>}>
        <Match when={data()?.status === "found"}>
          <h1 class="text-3xl font-bold text-gray-900 mb-4">{heading()}</h1>

          <div class="mb-8">
            <a
              href={foundData()!.externalProblemLink}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {t("viewOriginalProblem")}
            </a>
          </div>

          {/* Translations section */}
          <section class="mb-10">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-gray-800">{t("translationsSection")}</h2>
              {/* "Add translation" only for logged-in users who don't own one yet */}
              <Show when={foundData()?.isLoggedIn && !userOwnsATranslation()}>
                <A
                  href={`/problems/${params.site}/${params.externalProblemId}/add-translation`}
                  class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {t("addTranslation")}
                </A>
              </Show>
            </div>

            <Show
              when={(foundData()?.translations.length ?? 0) > 0}
              fallback={
                <p class="text-gray-500 italic">{t("noTranslationsYet")}</p>
              }
            >
              {/* Dropdown to pick a translation when there are multiple */}
              <Show when={(foundData()?.translations.length ?? 0) > 1}>
                <div class="mb-4">
                  <label for="translation-select" class="block text-sm font-medium text-gray-700 mb-1">
                    {t("selectTranslation")}
                  </label>
                  <select
                    id="translation-select"
                    class="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => setSelectedIdx(Number(e.currentTarget.value))}
                    value={selectedIdx()}
                  >
                    <For each={foundData()?.translations}>
                      {(tr, i) => (
                        <option value={i()}>
                          {tr.authorUsername ?? t("anonymous")}
                        </option>
                      )}
                    </For>
                  </select>
                </div>
              </Show>

              {/* Rendered translation content */}
              <Show when={selectedTranslation()}>
                <div class="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
                  <div class="flex items-center justify-between mb-3">
                    <p class="text-xs text-gray-400">
                      {t("by")} {selectedTranslation()!.authorUsername ?? t("anonymous")}
                    </p>
                    {/* Edit/Delete buttons shown only for the user's own translation */}
                    <Show when={selectedIsOwned()}>
                      <div class="flex gap-2">
                        <A
                          href={`/problems/${params.site}/${params.externalProblemId}/edit-translation`}
                          class="bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium px-3 py-1 rounded-lg transition-colors"
                        >
                          {t("editTranslation")}
                        </A>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleting()}
                          class="bg-red-100 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed text-red-700 text-sm font-medium px-3 py-1 rounded-lg transition-colors"
                        >
                          {deleting() ? t("deletingEllipsis") : t("deleteTranslation")}
                        </button>
                      </div>
                    </Show>
                  </div>
                  <Show when={deleteError()}>
                    <p class="text-sm text-red-600 mb-2">{deleteError()}</p>
                  </Show>
                  <div
                    class="markdown-content"
                    innerHTML={selectedTranslation()!.contentHtml}
                  />
                </div>
              </Show>
            </Show>
          </section>

          <section>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-gray-800">{t("solutionsSection")}</h2>
              <Show when={foundData()?.isLoggedIn}>
                <A
                  href={`/problems/${params.site}/${params.externalProblemId}/add-solution`}
                  class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {t("addSolution")}
                </A>
              </Show>
            </div>

            <Show
              when={(foundData()?.solutions.length ?? 0) > 0}
              fallback={<p class="text-gray-500 italic">{t("noSolutionsYet")}</p>}
            >
              <div class="flex flex-col gap-4">
                <Show when={foundData()?.solutionsTruncated}>
                  <div class="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
                    {tf("showingFirstNSolutions", { n: MAX_VISIBLE_SOLUTIONS })}
                  </div>
                </Show>
                <For each={foundData()?.solutions}>
                  {(solution) => {
                    const isOwned = () =>
                      !!(
                        foundData()?.currentUserDbId &&
                        solution.authorId === foundData()!.currentUserDbId
                      );

                    return (
                      <div class="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
                        <div class="flex items-center justify-between mb-3 gap-3">
                          <p class="text-xs text-gray-400">
                            {t("by")} {solution.authorUsername ?? t("anonymous")}
                          </p>
                          <Show when={isOwned()}>
                            <div class="flex gap-2">
                              <A
                                href={`/problems/${params.site}/${params.externalProblemId}/edit-solution/${solution.id}`}
                                class="bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium px-3 py-1 rounded-lg transition-colors"
                              >
                                {t("editSolution")}
                              </A>
                              <button
                                type="button"
                                onClick={() => handleSolutionDelete(solution.id)}
                                disabled={deletingSolutionId() === solution.id}
                                class="bg-red-100 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed text-red-700 text-sm font-medium px-3 py-1 rounded-lg transition-colors"
                              >
                                {deletingSolutionId() === solution.id
                                  ? t("deletingEllipsis")
                                  : t("deleteSolution")}
                              </button>
                            </div>
                          </Show>
                        </div>
                        <Show when={solutionDeleteError()?.id === solution.id}>
                          <p class="text-sm text-red-600 mb-2">
                            {solutionDeleteError()!.message}
                          </p>
                        </Show>
                        <div class="markdown-content" innerHTML={solution.contentHtml} />
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </section>
        </Match>
        <Match when={data()?.status === "not_found"}>
          <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <h1 class="text-2xl font-bold text-red-700 mb-2">{t("problemNotFound")}</h1>
            <p class="text-red-600">
              {t("problemNotFoundDesc")}
            </p>
          </div>
        </Match>
        <Match when={data()?.status === "invalid_params"}>
          <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <h1 class="text-2xl font-bold text-yellow-700 mb-2">{t("invalidProblem")}</h1>
            <p class="text-yellow-600">
              {t("invalidProblemDesc")}
            </p>
          </div>
        </Match>
        <Match when={data()?.status === "server_error"}>
          <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <h1 class="text-2xl font-bold text-red-700 mb-2">{t("serverError")}</h1>
            <p class="text-red-600">
              {t("serverErrorDesc")}
            </p>
          </div>
        </Match>
      </Switch>
    </main>
  );
}
