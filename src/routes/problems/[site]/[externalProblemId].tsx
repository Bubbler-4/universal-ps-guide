import { createEffect, Switch, Match } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { cache, createAsync, redirect, useParams } from "@solidjs/router";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { getDb } from "~/db";
import { problems } from "~/db/schema";
import { getSiteDisplayName, normalizeProblemId } from "~/lib/problems";

type ProblemResult =
  | { status: "found"; site: string; externalProblemId: string }
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

    if (existing) {
      return { status: "found", site: existing.site, externalProblemId: existing.externalProblemId };
    }

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

    const problem =
      inserted ??
      (await db
        .select()
        .from(problems)
        .where(and(eq(problems.site, normalizedSite), eq(problems.externalProblemId, normalizedId)))
        .get());

    if (!problem) {
      return { status: "create_failed" };
    }

    return { status: "found", site: problem.site, externalProblemId: problem.externalProblemId };
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
          <h1 class="text-3xl font-bold text-gray-900">{heading()}</h1>
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
