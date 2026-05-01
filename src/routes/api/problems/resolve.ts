import type { APIEvent } from "@solidjs/start/server";
import { problems } from "~/db/schema";
import { eq, and } from "drizzle-orm";
import { getD1 } from "~/server/db";

/**
 * POST /api/problems/resolve
 * Body: { site: string, externalProblemId: string }
 * Upserts the problem row and returns it.
 */
export async function POST(event: APIEvent) {
  const body = await event.request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { site, externalProblemId } = body as Record<string, unknown>;

  if (typeof site !== "string" || typeof externalProblemId !== "string") {
    return new Response(
      JSON.stringify({
        error: "Body must include: site (string), externalProblemId (string)",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const trimmedSite = site.trim();
  const trimmedId = externalProblemId.trim();

  if (!trimmedSite || !trimmedId) {
    return new Response(
      JSON.stringify({ error: "site and externalProblemId must not be empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const db = getD1(event);

  // Attempt an atomic insert and return the new row in one round-trip.
  // If the row already exists (unique conflict), the insert is silently
  // ignored and `inserted` will be undefined, so we fall back to a SELECT.
  const inserted = await db
    .insert(problems)
    .values({ site: trimmedSite, externalProblemId: trimmedId })
    .onConflictDoNothing()
    .returning()
    .get();

  const problem =
    inserted ??
    (await db
      .select()
      .from(problems)
      .where(
        and(
          eq(problems.site, trimmedSite),
          eq(problems.externalProblemId, trimmedId)
        )
      )
      .get());

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
