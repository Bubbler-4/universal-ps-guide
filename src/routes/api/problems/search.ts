import type { APIEvent } from "@solidjs/start/server";
import { problems } from "~/db/schema";
import { and, asc, eq, isNull, like, sql } from "drizzle-orm";
import { getD1 } from "~/server/db";
import { normalizeProblemId } from "~/lib/problems";

const MAX_RESULTS = 10;

/**
 * GET /api/problems/search?site=xxx&prefix=YYY
 * Returns up to 10 prefix matches for the given site and normalized problem ID prefix.
 * Exact matches are listed first.
 */
export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const site = url.searchParams.get("site") ?? "";
  const rawPrefix = url.searchParams.get("prefix") ?? "";
  const prefix = normalizeProblemId(rawPrefix);

  if (!site) {
    return new Response(JSON.stringify({ error: "Missing required query param: site" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!prefix) {
    return new Response(JSON.stringify({ matches: [], hasExactMatch: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getD1(event);

  const rows = await db
    .select({ externalProblemId: problems.externalProblemId })
    .from(problems)
    .where(
      and(
        eq(problems.site, site),
        like(problems.externalProblemId, `${prefix}%`),
        eq(problems.status, "active"),
        isNull(problems.deletedAt)
      )
    )
    .orderBy(
      sql`CASE WHEN ${problems.externalProblemId} = ${prefix} THEN 0 ELSE 1 END`,
      asc(problems.externalProblemId)
    )
    .limit(MAX_RESULTS)
    .all();

  const hasExactMatch = rows.length > 0 && rows[0].externalProblemId === prefix;
  const matches = rows.map((r) => r.externalProblemId);

  return new Response(JSON.stringify({ matches, hasExactMatch }), {
    headers: { "Content-Type": "application/json" },
  });
}
