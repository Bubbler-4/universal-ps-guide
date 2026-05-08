import type { APIEvent } from "@solidjs/start/server";
import { problems, solutions, translations } from "~/db/schema";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { getD1 } from "~/server/db";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { MAX_VISIBLE_SOLUTIONS } from "~/lib/solutions";

/**
 * GET /api/problems/:site/:externalProblemId
 * Returns problem details together with all active translations and a capped
 * list of active solutions.
 */
export async function GET(event: APIEvent) {
  const { site, externalProblemId } = event.params;

  if (!site || !externalProblemId) {
    return new Response(
      JSON.stringify({ error: "Missing route params: site, externalProblemId" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const db = getD1(event);

  const problem = await db
    .select()
    .from(problems)
    .where(
      and(eq(problems.site, site), eq(problems.externalProblemId, externalProblemId))
    )
    .get();

  if (!problem) {
    return new Response(JSON.stringify({ error: "Problem not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = await db
    .select()
    .from(translations)
    .where(
      and(
        eq(translations.problemId, problem.id),
        eq(translations.status, "active"),
        isNull(translations.deletedAt)
      )
    )
    .orderBy(asc(translations.createdAt))
    .all();

  const solutionRows = await db
    .select()
    .from(solutions)
    .where(
      and(
        eq(solutions.problemId, problem.id),
        eq(solutions.status, "active"),
        isNull(solutions.deletedAt)
      )
    )
    .orderBy(asc(solutions.createdAt))
    .limit(MAX_VISIBLE_SOLUTIONS + 1)
    .all();

  const solutionsTruncated = solutionRows.length > MAX_VISIBLE_SOLUTIONS;

  // The expected number of solutions per problem is small, so the problem page
  // keeps a simple capped list here instead of implementing pagination.
  return new Response(
    JSON.stringify({
      problem,
      translations: rows,
      solutions: solutionRows.slice(0, MAX_VISIBLE_SOLUTIONS),
      solutionsTruncated,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * PATCH /api/problems/:site/:externalProblemId
 * Body: { externalProblemLink: string }
 * Updates the external link for a problem. Requires authentication.
 */
export async function PATCH(event: APIEvent) {
  const env = getCloudflareEnv(event);
  const session = await getServerSession(event.request, env);
  if (!session || session.needsUsername || !session.dbUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { site, externalProblemId } = event.params;
  if (!site || !externalProblemId) {
    return new Response(
      JSON.stringify({ error: "Missing route params: site, externalProblemId" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await event.request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { externalProblemLink } = body as Record<string, unknown>;
  if (typeof externalProblemLink !== "string" || !externalProblemLink.trim()) {
    return new Response(
      JSON.stringify({ error: "externalProblemLink must be a non-empty string" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(externalProblemLink.trim());
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

  const problem = await db
    .select({ id: problems.id })
    .from(problems)
    .where(and(eq(problems.site, site), eq(problems.externalProblemId, externalProblemId)))
    .get();

  if (!problem) {
    return new Response(JSON.stringify({ error: "Problem not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const updated = await db
    .update(problems)
    .set({
      externalProblemLink: externalProblemLink.trim(),
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(problems.id, problem.id))
    .returning()
    .get();

  return new Response(JSON.stringify({ problem: updated }), {
    headers: { "Content-Type": "application/json" },
  });
}
