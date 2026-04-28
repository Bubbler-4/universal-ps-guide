import type { APIEvent } from "@solidjs/start/server";
import { problems, translations } from "~/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { getD1 } from "~/server/db";

/**
 * GET /api/problems/:site/:externalProblemId
 * Returns problem details together with all active translations.
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

  return new Response(JSON.stringify({ problem, translations: rows }), {
    headers: { "Content-Type": "application/json" },
  });
}
