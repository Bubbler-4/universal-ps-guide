import type { APIEvent } from "@solidjs/start/server";
import { problems } from "~/db/schema";
import { getD1 } from "~/server/db";

/**
 * POST /api/problems/resolve
 * Body: { site: string, externalProblemId: string, externalProblemLink: string }
 * Upserts the problem row (updating the link on conflict) and returns it.
 */
export async function POST(event: APIEvent) {
  const body = await event.request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { site, externalProblemId, externalProblemLink } = body as Record<string, unknown>;

  if (
    typeof site !== "string" ||
    typeof externalProblemId !== "string" ||
    typeof externalProblemLink !== "string"
  ) {
    return new Response(
      JSON.stringify({
        error:
          "Body must include: site (string), externalProblemId (string), externalProblemLink (string)",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const trimmedSite = site.trim();
  const trimmedId = externalProblemId.trim();
  const trimmedLink = externalProblemLink.trim();

  if (!trimmedSite || !trimmedId) {
    return new Response(
      JSON.stringify({ error: "site and externalProblemId must not be empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!trimmedLink) {
    return new Response(
      JSON.stringify({ error: "externalProblemLink must not be empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedLink);
  } catch {
    return new Response(
      JSON.stringify({ error: "externalProblemLink must be a valid URL" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return new Response(
      JSON.stringify({ error: "externalProblemLink must use http or https" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const db = getD1(event);

  // Upsert: insert or update the link on conflict.
  const problem = await db
    .insert(problems)
    .values({ site: trimmedSite, externalProblemId: trimmedId, externalProblemLink: trimmedLink })
    .onConflictDoUpdate({
      target: [problems.site, problems.externalProblemId],
      set: { externalProblemLink: trimmedLink },
    })
    .returning()
    .get();

  if (!problem) {
    return new Response(JSON.stringify({ error: "Failed to resolve problem" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ problem }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
