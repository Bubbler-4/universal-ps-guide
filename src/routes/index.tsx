import { getRequestEvent } from "solid-js/web";
import { cache, createAsync, redirect } from "@solidjs/router";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";

const checkSession = cache(async () => {
  "use server";
  const event = getRequestEvent(); console.log("checkSession");
  if (!event) return;
  const env = getCloudflareEnv(event);
  const session = await getServerSession(event.request, env); console.log("checkSession2", session);
  if (session?.needsUsername) {
    throw redirect("/setup-username");
  }
}, "checkSession");

export const route = {
  load: () => checkSession(),
};

export default function Home() {
  createAsync(() => checkSession());
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
        <p class="text-gray-500">Problem search coming soon…</p>
      </div>
    </main>
  );
}
