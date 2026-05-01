import { createSignal } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { cache, createAsync, redirect, useNavigate } from "@solidjs/router";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { SITES, normalizeProblemId } from "~/lib/problems";

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

  function handleSearch(e: SubmitEvent) {
    e.preventDefault();
    const normalized = normalizeProblemId(problemId());
    if (!normalized) return;
    navigate(`/problems/${site()}/${normalized}`);
  }

  return (
    <main class="mx-auto max-w-5xl px-4 py-12">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">Universal PS Guide</h1>
        <p class="text-lg text-gray-600 max-w-xl mx-auto">
          Search competitive programming problems and explore community translations
          and editorial solutions across major online judges.
        </p>
      </div>
      <div class="mt-12 bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Search a Problem</h2>
        <form onSubmit={handleSearch} class="flex flex-col sm:flex-row gap-3">
          <select
            id="site-select"
            aria-label="Online judge site"
            value={site()}
            onChange={(e) => setSite(e.currentTarget.value)}
            class="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SITES.map((s) => (
              <option value={s.toLowerCase()}>{s}</option>
            ))}
          </select>
          <input
            id="problem-id-input"
            type="text"
            aria-label="Problem ID"
            placeholder="Problem ID (e.g. 1700A)"
            value={problemId()}
            onInput={(e) => setProblemId(e.currentTarget.value)}
            class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Search
          </button>
        </form>
      </div>
    </main>
  );
}
