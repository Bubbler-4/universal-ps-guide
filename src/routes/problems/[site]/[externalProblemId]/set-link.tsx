import { createEffect, createSignal, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { cache, createAsync, redirect, useParams, A } from "@solidjs/router";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { getDb } from "~/db";
import { problems } from "~/db/schema";
import { getSiteDisplayName, normalizeProblemId } from "~/lib/problems";

type PageData =
  | {
      status: "ok";
      site: string;
      externalProblemId: string;
      currentLink: string | null;
    }
  | { status: "problem_not_found" }
  | { status: "invalid_params" }
  | { status: "server_error" };

const getSetLinkData = cache(
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

    const normalizedSite = site.trim().toLowerCase();
    const normalizedId = normalizeProblemId(externalProblemId);
    if (!getSiteDisplayName(normalizedSite) || !normalizedId) {
      return { status: "invalid_params" };
    }

    if (site !== normalizedSite || externalProblemId !== normalizedId) {
      throw redirect(`/problems/${normalizedSite}/${normalizedId}/set-link`, 301);
    }

    const db = getDb(env.DB as never);

    const problem = await db
      .select({ id: problems.id, externalProblemLink: problems.externalProblemLink })
      .from(problems)
      .where(and(eq(problems.site, normalizedSite), eq(problems.externalProblemId, normalizedId)))
      .get();

    if (!problem) {
      return { status: "problem_not_found" };
    }

    return {
      status: "ok",
      site: normalizedSite,
      externalProblemId: normalizedId,
      currentLink: problem.externalProblemLink ?? null,
    };
  },
  "getSetLinkData"
);

export const route = {
  load: ({ params }: { params: { site: string; externalProblemId: string } }) =>
    getSetLinkData(params.site, params.externalProblemId),
};

export default function SetLinkPage() {
  const params = useParams<{ site: string; externalProblemId: string }>();
  const data = createAsync(() => getSetLinkData(params.site, params.externalProblemId));

  const displayName = () => getSiteDisplayName(params.site) ?? params.site;
  const heading = () => `${displayName()}/${params.externalProblemId} - Set problem link`;

  const [link, setLink] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string | null>(null);

  // Pre-fill the input with the current link when the page loads.
  createEffect(() => {
    const d = data();
    if (d?.status === "ok") {
      setLink(d.currentLink ?? "");
    }
  });

  const handleSubmit = async () => {
    const d = data();
    if (d?.status !== "ok") return;

    const trimmed = link().trim();
    if (!trimmed) {
      setSubmitError("Please enter a URL.");
      return;
    }

    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        setSubmitError("URL must use http or https.");
        return;
      }
    } catch {
      setSubmitError("Please enter a valid URL.");
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/problems/${d.site}/${d.externalProblemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalProblemLink: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(
          (body as { error?: string }).error ?? "Failed to save link. Please try again."
        );
      } else {
        window.location.href = `/problems/${d.site}/${d.externalProblemId}`;
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

      <Show when={data()?.status === "problem_not_found"}>
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-yellow-700 mb-2">Problem Not Found</h1>
          <p class="text-yellow-600 mb-4">
            This problem does not exist yet. Please visit the problem page to create it.
          </p>
          <A
            href={`/problems/${params.site}/${params.externalProblemId}`}
            class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Go to problem page
          </A>
        </div>
      </Show>

      <Show when={data()?.status === "ok"}>
        <h1 class="text-2xl font-bold text-gray-900 mb-6">{heading()}</h1>

        <div class="flex flex-col gap-6 max-w-xl">
          <div>
            <label for="problem-link" class="block text-sm font-medium text-gray-700 mb-1">
              Link to the original problem
            </label>
            <input
              id="problem-link"
              type="url"
              value={link()}
              onInput={(e) => setLink(e.currentTarget.value)}
              placeholder="https://..."
              class="w-full border border-gray-400 bg-white rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting()}
              class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {submitting() ? "Saving…" : "Save link"}
            </button>
            <A
              href={`/problems/${params.site}/${params.externalProblemId}`}
              class="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-5 py-2 rounded-lg transition-colors"
            >
              Cancel
            </A>
          </div>

          <Show when={submitError()}>
            <p role="alert" class="text-sm text-red-600">{submitError()}</p>
          </Show>
        </div>
      </Show>
    </main>
  );
}
