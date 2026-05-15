import { createSignal, For, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { cache, createAsync, redirect, useNavigate } from "@solidjs/router";
import { cookieStorage, makePersisted } from "@solid-primitives/storage";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { SITES, normalizeProblemId } from "~/lib/problems";
import { useI18n } from "~/lib/i18n";
import { getDb } from "~/db";
import { problems, solutions, translations, users } from "~/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { ProblemSearchInput } from "~/components/ProblemSearchInput";

type HomeData = {
  recentProblems: {
    site: string;
    externalProblemId: string;
    translationCount: number;
    solutionCount: number;
  }[];
  recentTranslations: {
    site: string;
    externalProblemId: string;
    authorUsername: string | null;
  }[];
  recentSolutions: {
    site: string;
    externalProblemId: string;
    authorUsername: string | null;
  }[];
};

const DEFAULT_SITE = SITES[0].toLowerCase();
const SITE_KEYS = new Set(SITES.map((site) => site.toLowerCase()));

const checkSession = cache(async () => {
  "use server";
  const event = getRequestEvent();
  if (!event) return;
  const env = getCloudflareEnv(event);
  const session = await getServerSession(event.request, env);
  if (session?.needsUsername) {
    throw redirect("/setup-username");
  }
}, "checkSession");

const getHomeData = cache(async (): Promise<HomeData> => {
  "use server";
  const event = getRequestEvent();
  if (!event) {
    return { recentProblems: [], recentTranslations: [], recentSolutions: [] };
  }

  const env = getCloudflareEnv(event);
  if (!env.DB) {
    return { recentProblems: [], recentTranslations: [], recentSolutions: [] };
  }

  const db = getDb(env.DB as never);

  const translationCounts = db
    .select({
      problemId: translations.problemId,
      translationCount: sql<number>`count(*)`.mapWith(Number).as("translationCount"),
    })
    .from(translations)
    .where(and(eq(translations.status, "active"), isNull(translations.deletedAt)))
    .groupBy(translations.problemId)
    .as("translation_counts");

  const solutionCounts = db
    .select({
      problemId: solutions.problemId,
      solutionCount: sql<number>`count(*)`.mapWith(Number).as("solutionCount"),
    })
    .from(solutions)
    .where(and(eq(solutions.status, "active"), isNull(solutions.deletedAt)))
    .groupBy(solutions.problemId)
    .as("solution_counts");

  const [recentProblems, recentTranslations, recentSolutions] = await Promise.all([
    db
      .select({
        site: problems.site,
        externalProblemId: problems.externalProblemId,
        translationCount: sql<number>`coalesce(${translationCounts.translationCount}, 0)`
          .mapWith(Number)
          .as("translationCount"),
        solutionCount: sql<number>`coalesce(${solutionCounts.solutionCount}, 0)`
          .mapWith(Number)
          .as("solutionCount"),
      })
      .from(problems)
      .leftJoin(translationCounts, eq(translationCounts.problemId, problems.id))
      .leftJoin(solutionCounts, eq(solutionCounts.problemId, problems.id))
      .where(and(eq(problems.status, "active"), isNull(problems.deletedAt)))
      .orderBy(desc(problems.createdAt))
      .limit(20)
      .all(),
    db
      .select({
        site: problems.site,
        externalProblemId: problems.externalProblemId,
        authorUsername: users.username,
      })
      .from(translations)
      .innerJoin(problems, eq(problems.id, translations.problemId))
      .leftJoin(users, eq(users.id, translations.authorId))
      .where(
        and(
          eq(translations.status, "active"),
          isNull(translations.deletedAt),
          eq(problems.status, "active"),
          isNull(problems.deletedAt)
        )
      )
      .orderBy(desc(translations.createdAt))
      .limit(20)
      .all(),
    db
      .select({
        site: problems.site,
        externalProblemId: problems.externalProblemId,
        authorUsername: users.username,
      })
      .from(solutions)
      .innerJoin(problems, eq(problems.id, solutions.problemId))
      .leftJoin(users, eq(users.id, solutions.authorId))
      .where(
        and(
          eq(solutions.status, "active"),
          isNull(solutions.deletedAt),
          eq(problems.status, "active"),
          isNull(problems.deletedAt)
        )
      )
      .orderBy(desc(solutions.createdAt))
      .limit(20)
      .all(),
  ]);

  return { recentProblems, recentTranslations, recentSolutions };
}, "getHomeData");

export const route = {
  load: () => Promise.all([checkSession(), getHomeData()]),
};

export default function Home() {
  createAsync(() => checkSession());
  const homeData = createAsync(() => getHomeData());
  const navigate = useNavigate();
  const [site, setSite] = makePersisted(createSignal(DEFAULT_SITE), {
    name: "site",
    storage: cookieStorage.withOptions({ path: "/", sameSite: "Lax", maxAge: 60 * 60 * 24 * 365 }),
    serialize: (value: string) => value,
    deserialize: (value: string) => (SITE_KEYS.has(value) ? value : DEFAULT_SITE),
  });
  const [problemId, setProblemId] = createSignal("");
  const { t } = useI18n();
  const problemHref = (site: string, externalProblemId: string) =>
    `/problems/${site.toLowerCase()}/${encodeURIComponent(externalProblemId)}`;

  function handleSearch(e: SubmitEvent) {
    e.preventDefault();
    const normalized = normalizeProblemId(problemId());
    if (!normalized) return;
    navigate(`/problems/${site()}/${normalized}`);
  }

  return (
    <main class="mx-auto max-w-5xl px-4 py-12">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">Universal PS Guide</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
          {t("homeSubtitle")}
        </p>
      </div>
      <div class="mt-12 bg-white dark:bg-gray-900 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-8">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">{t("searchProblem")}</h2>
        <form onSubmit={handleSearch} class="flex flex-col sm:flex-row gap-3">
          <select
            id="site-select"
            aria-label={t("onlineJudgeSiteLabel")}
            value={site()}
            onChange={(e) => setSite(e.currentTarget.value)}
            class="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            {SITES.map((s) => (
              <option value={s.toLowerCase()}>{s}</option>
            ))}
          </select>
          <ProblemSearchInput
            site={site}
            value={problemId}
            onInput={setProblemId}
            placeholder={t("problemIdPlaceholder")}
            mode="home"
          />
          <button
            type="submit"
            class="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            {t("search")}
          </button>
        </form>
      </div>
      <div class="mt-12 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section class="bg-white dark:bg-gray-900 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            {t("recentProblems")}
          </h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left text-gray-700 dark:text-gray-300">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-700">
                  <th class="py-2 pr-3 font-semibold">Site</th>
                  <th class="py-2 pr-3 font-semibold">ID</th>
                  <th class="py-2 pr-3 font-semibold">📝</th>
                  <th class="py-2 font-semibold">💡</th>
                </tr>
              </thead>
              <tbody>
                <For each={homeData()?.recentProblems ?? []}>
                  {(row) => (
                    <tr class="border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <td class="py-2 pr-3">
                        <a href={problemHref(row.site, row.externalProblemId)} class="hover:underline">
                          {row.site}
                        </a>
                      </td>
                      <td class="py-2 pr-3">
                        <a href={problemHref(row.site, row.externalProblemId)} class="hover:underline">
                          {row.externalProblemId}
                        </a>
                      </td>
                      <td class="py-2 pr-3">{row.translationCount}</td>
                      <td class="py-2">{row.solutionCount}</td>
                    </tr>
                  )}
                </For>
                {(homeData()?.recentProblems.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={4} class="py-3 text-gray-500 dark:text-gray-400">
                      {t("noRecentItems")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section class="bg-white dark:bg-gray-900 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            {t("recentTranslations")}
          </h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left text-gray-700 dark:text-gray-300">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-700">
                  <th class="py-2 pr-3 font-semibold">Site</th>
                  <th class="py-2 pr-3 font-semibold">ID</th>
                  <th class="py-2 font-semibold">👤</th>
                </tr>
              </thead>
              <tbody>
                <For each={homeData()?.recentTranslations ?? []}>
                  {(row) => (
                    <tr class="border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <td class="py-2 pr-3">
                        <a href={problemHref(row.site, row.externalProblemId)} class="hover:underline">
                          {row.site}
                        </a>
                      </td>
                      <td class="py-2 pr-3">
                        <a href={problemHref(row.site, row.externalProblemId)} class="hover:underline">
                          {row.externalProblemId}
                        </a>
                      </td>
                      <td class="py-2">{row.authorUsername ?? t("anonymous")}</td>
                    </tr>
                  )}
                </For>
                {(homeData()?.recentTranslations.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={3} class="py-3 text-gray-500 dark:text-gray-400">
                      {t("noRecentItems")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section class="bg-white dark:bg-gray-900 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            {t("recentSolutions")}
          </h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left text-gray-700 dark:text-gray-300">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-700">
                  <th class="py-2 pr-3 font-semibold">Site</th>
                  <th class="py-2 pr-3 font-semibold">ID</th>
                  <th class="py-2 font-semibold">👤</th>
                </tr>
              </thead>
              <tbody>
                <For each={homeData()?.recentSolutions ?? []}>
                  {(row) => (
                    <tr class="border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <td class="py-2 pr-3">
                        <a href={problemHref(row.site, row.externalProblemId)} class="hover:underline">
                          {row.site}
                        </a>
                      </td>
                      <td class="py-2 pr-3">
                        <a href={problemHref(row.site, row.externalProblemId)} class="hover:underline">
                          {row.externalProblemId}
                        </a>
                      </td>
                      <td class="py-2">{row.authorUsername ?? t("anonymous")}</td>
                    </tr>
                  )}
                </For>
                {(homeData()?.recentSolutions.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={3} class="py-3 text-gray-500 dark:text-gray-400">
                      {t("noRecentItems")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
