import type { APIEvent } from "@solidjs/start/server";
import { problems, solutions, users } from "~/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { getD1 } from "~/server/db";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";

/**
 * GET /api/solutions?site=...&externalProblemId=...
 * Returns all active solutions for the given problem.
 */
export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const site = url.searchParams.get("site")?.trim() ?? null;
  const externalProblemId = url.searchParams.get("externalProblemId")?.trim() ?? null;

  if (!site || !externalProblemId) {
    return new Response(
      JSON.stringify({ error: "Missing required query params: site, externalProblemId" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const db = getD1(event);

  const problem = await db
    .select({ id: problems.id })
    .from(problems)
    .where(
      and(eq(problems.site, site), eq(problems.externalProblemId, externalProblemId))
    )
    .get();

  if (!problem) {
    return new Response(JSON.stringify({ solutions: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = await db
    .select({
      id: solutions.id,
      problemId: solutions.problemId,
      authorId: solutions.authorId,
      authorUsername: users.username,
      content: solutions.content,
      status: solutions.status,
      createdAt: solutions.createdAt,
      updatedAt: solutions.updatedAt,
    })
    .from(solutions)
    .leftJoin(users, eq(users.id, solutions.authorId))
    .where(
      and(
        eq(solutions.problemId, problem.id),
        eq(solutions.status, "active"),
        isNull(solutions.deletedAt)
      )
    )
    .orderBy(asc(solutions.createdAt))
    .all();

  return new Response(JSON.stringify({ solutions: rows }), {
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/solutions
 * Body: { site, externalProblemId, content }
 * The author is derived from the authenticated session.
 * Creates a new solution for an existing problem.
 */
export async function POST(event: APIEvent) {
  const env = getCloudflareEnv(event);
  const session = await getServerSession(event.request, env);
  if (!session || session.needsUsername || !session.dbUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const authorId = session.dbUserId;

  const body = await event.request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { site, externalProblemId, content } = body as Record<string, unknown>;

  if (
    typeof site !== "string" ||
    typeof externalProblemId !== "string" ||
    typeof content !== "string"
  ) {
    return new Response(
      JSON.stringify({
        error: "Body must include: site (string), externalProblemId (string), content (string)",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!site.trim() || !externalProblemId.trim() || !content.trim()) {
    return new Response(
      JSON.stringify({ error: "site, externalProblemId, and content must not be empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const db = getD1(event);

  const problem = await db
    .select({ id: problems.id })
    .from(problems)
    .where(
      and(
        eq(problems.site, site.trim()),
        eq(problems.externalProblemId, externalProblemId.trim())
      )
    )
    .get();

  if (!problem) {
    return new Response(JSON.stringify({ error: "Problem not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const inserted = await db
    .insert(solutions)
    .values({ problemId: problem.id, authorId, content: content.trim() })
    .returning()
    .get();

  return new Response(JSON.stringify({ solution: inserted }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
