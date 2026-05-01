import { createEffect, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { cache, createAsync, useParams } from "@solidjs/router";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { getDb } from "~/db";
import { problems } from "~/db/schema";
import { getSiteDisplayName } from "~/lib/problems";

type ProblemResult =
  | { found: true; site: string; externalProblemId: string }
  | { found: false; loggedIn: false }
  | { found: false; loggedIn: true };

const getProblemData = cache(
  async (site: string, externalProblemId: string): Promise<ProblemResult> => {
    "use server";
    const event = getRequestEvent();
    if (!event) return { found: false, loggedIn: false };

    const env = getCloudflareEnv(event);
    if (!env.DB) return { found: false, loggedIn: false };

    const db = getDb(env.DB as never);
    const session = await getServerSession(event.request, env);
    const isLoggedIn = !!(session && !session.needsUsername);

    const existing = await db
      .select()
      .from(problems)
      .where(and(eq(problems.site, site), eq(problems.externalProblemId, externalProblemId)))
      .get();

    if (existing) {
      return { found: true, site: existing.site, externalProblemId: existing.externalProblemId };
    }

    if (!isLoggedIn) {
      return { found: false, loggedIn: false };
    }

    // Logged-in user: create the problem and show the page.
    const inserted = await db
      .insert(problems)
      .values({ site, externalProblemId })
      .onConflictDoNothing()
      .returning()
      .get();

    const problem =
      inserted ??
      (await db
        .select()
        .from(problems)
        .where(and(eq(problems.site, site), eq(problems.externalProblemId, externalProblemId)))
        .get());

    if (!problem) {
      return { found: false, loggedIn: true };
    }

    return { found: true, site: problem.site, externalProblemId: problem.externalProblemId };
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
    if (d?.found) {
      document.title = heading();
    }
  });

  return (
    <main class="mx-auto max-w-5xl px-4 py-12">
      <Show when={data()?.found} fallback={
        <Show
          when={data() !== undefined}
          fallback={<p class="text-gray-500">Loading…</p>}
        >
          <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <h1 class="text-2xl font-bold text-red-700 mb-2">Problem Not Found</h1>
            <p class="text-red-600">
              This problem does not exist yet. Sign in to create it.
            </p>
          </div>
        </Show>
      }>
        <h1 class="text-3xl font-bold text-gray-900">{heading()}</h1>
      </Show>
    </main>
  );
}
