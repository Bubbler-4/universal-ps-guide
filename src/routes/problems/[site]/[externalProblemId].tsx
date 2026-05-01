import { createEffect, createSignal, For, Show, Switch, Match } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { cache, createAsync, redirect, useParams, A } from "@solidjs/router";
import { eq, and, isNull, asc } from "drizzle-orm";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { getDb } from "~/db";
import { problems, translations, users } from "~/db/schema";
import { getSiteDisplayName, normalizeProblemId } from "~/lib/problems";
import { renderMarkdown } from "~/lib/markdown";

type TranslationWithAuthor = {
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
      isLoggedIn: boolean;
      translations: TranslationWithAuthor[];
    }
  | { status: "not_found" }
  | { status: "invalid_params" }
  | { status: "server_error" }
  | { status: "create_failed" };

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

    const existing = await db
      .select()
      .from(problems)
      .where(and(eq(problems.site, normalizedSite), eq(problems.externalProblemId, normalizedId)))
      .get();

    let problem = existing;

    if (!existing) {
      if (!isLoggedIn) {
        return { status: "not_found" };
      }

      // Logged-in user: create the problem and show the page.
      const inserted = await db
        .insert(problems)
        .values({ site: normalizedSite, externalProblemId: normalizedId })
        .onConflictDoNothing()
        .returning()
        .get();

      problem =
        inserted ??
        (await db
          .select()
          .from(problems)
          .where(and(eq(problems.site, normalizedSite), eq(problems.externalProblemId, normalizedId)))
          .get());

      if (!problem) {
        return { status: "create_failed" };
      }
    }

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
          eq(translations.problemId, problem!.id),
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

    return {
      status: "found",
      site: problem!.site,
      externalProblemId: problem!.externalProblemId,
      isLoggedIn,
      translations: translationList,
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

  const displayName = () => getSiteDisplayName(params.site) ?? params.site;
  const heading = () => `${displayName()}/${params.externalProblemId}`;

  const foundData = () => {
    const d = data();
    return d?.status === "found" ? d : null;
  };

  // Track selected translation index.
  const [selectedIdx, setSelectedIdx] = createSignal(0);
  const selectedTranslation = () => foundData()?.translations[selectedIdx()];

  createEffect(() => {
    const d = data();
    if (d?.status === "found") {
      document.title = heading();
    }
  });

  return (
    <main class="mx-auto max-w-5xl px-4 py-12">
      <Switch fallback={<p class="text-gray-500">Loading…</p>}>
        <Match when={data()?.status === "found"}>
          <h1 class="text-3xl font-bold text-gray-900 mb-8">{heading()}</h1>

          {/* Translations section */}
          <section class="mb-10">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-gray-800">Translations</h2>
              <Show when={foundData()?.isLoggedIn}>
                <A
                  href={`/problems/${params.site}/${params.externalProblemId}/add-translation`}
                  class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Add translation
                </A>
              </Show>
            </div>

            <Show
              when={(foundData()?.translations.length ?? 0) > 0}
              fallback={
                <p class="text-gray-500 italic">No translations yet.</p>
              }
            >
              {/* Dropdown to pick a translation when there are multiple */}
              <Show when={(foundData()?.translations.length ?? 0) > 1}>
                <div class="mb-4">
                  <label for="translation-select" class="block text-sm font-medium text-gray-700 mb-1">
                    Select translation
                  </label>
                  <select
                    id="translation-select"
                    class="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => setSelectedIdx(Number(e.currentTarget.value))}
                    value={selectedIdx()}
                  >
                    <For each={foundData()?.translations}>
                      {(t, i) => (
                        <option value={i()}>
                          {t.authorUsername ?? "Anonymous"}
                        </option>
                      )}
                    </For>
                  </select>
                </div>
              </Show>

              {/* Rendered translation content */}
              <Show when={selectedTranslation()}>
                <div class="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
                  <p class="text-xs text-gray-400 mb-3">
                    By {selectedTranslation()!.authorUsername ?? "Anonymous"}
                  </p>
                  <div
                    class="prose max-w-none"
                    innerHTML={selectedTranslation()!.contentHtml}
                  />
                </div>
              </Show>
            </Show>
          </section>
        </Match>
        <Match when={data()?.status === "not_found"}>
          <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <h1 class="text-2xl font-bold text-red-700 mb-2">Problem Not Found</h1>
            <p class="text-red-600">
              This problem does not exist yet. Sign in to create it.
            </p>
          </div>
        </Match>
        <Match when={data()?.status === "create_failed"}>
          <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <h1 class="text-2xl font-bold text-red-700 mb-2">Failed to Create Problem</h1>
            <p class="text-red-600">
              Something went wrong while creating the problem. Please try again.
            </p>
          </div>
        </Match>
        <Match when={data()?.status === "invalid_params"}>
          <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <h1 class="text-2xl font-bold text-yellow-700 mb-2">Invalid Problem</h1>
            <p class="text-yellow-600">
              The site or problem ID is not valid.
            </p>
          </div>
        </Match>
        <Match when={data()?.status === "server_error"}>
          <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <h1 class="text-2xl font-bold text-red-700 mb-2">Server Error</h1>
            <p class="text-red-600">
              Something went wrong on our end. Please try again later.
            </p>
          </div>
        </Match>
      </Switch>
    </main>
  );
}
