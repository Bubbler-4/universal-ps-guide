import { createSignal } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { cache, createAsync, redirect, useNavigate } from "@solidjs/router";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { SITES, normalizeProblemId } from "~/lib/problems";
import { useI18n } from "~/lib/i18n";

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

export const route = {
  load: () => checkSession(),
};

export default function Home() {
  createAsync(() => checkSession());
  const navigate = useNavigate();
  const [site, setSite] = createSignal(SITES[0].toLowerCase());
  const [problemId, setProblemId] = createSignal("");
  const { t } = useI18n();

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
          <input
            id="problem-id-input"
            type="text"
            aria-label={t("problemIdLabel")}
            placeholder={t("problemIdPlaceholder")}
            value={problemId()}
            onInput={(e) => setProblemId(e.currentTarget.value)}
            class="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <button
            type="submit"
            class="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            {t("search")}
          </button>
        </form>
      </div>
    </main>
  );
}
