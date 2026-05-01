import type { APIEvent } from "@solidjs/start/server";
import { problems, translations, users } from "~/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { getD1 } from "~/server/db";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";

/**
 * GET /api/translations?site=...&externalProblemId=...
 * Returns all active translations for the given problem.
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
    return new Response(JSON.stringify({ translations: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = await db
    .select({
      id: translations.id,
      problemId: translations.problemId,
      authorId: translations.authorId,
      authorUsername: users.username,
      content: translations.content,
      status: translations.status,
      createdAt: translations.createdAt,
      updatedAt: translations.updatedAt,
    })
    .from(translations)
    .leftJoin(users, eq(users.id, translations.authorId))
    .where(
      and(
        eq(translations.problemId, problem.id),
        eq(translations.status, "active"),
        isNull(translations.deletedAt)
      )
    )
    .orderBy(asc(translations.createdAt))
    .all();

  return new Response(JSON.stringify({ translations: rows }), {
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/translations
 * Body: { site, externalProblemId, content }
 * The author is derived from the authenticated session.
 * Creates a new translation, upserting the problem if it doesn't exist yet.
 */
export async function POST(event: APIEvent) {
  // Authenticate via session; authorId is never trusted from the client.
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

  // Upsert the problem
  await db
    .insert(problems)
    .values({ site: site.trim(), externalProblemId: externalProblemId.trim() })
    .onConflictDoNothing()
    .run();

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
    return new Response(JSON.stringify({ error: "Failed to resolve problem" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const inserted = await db
    .insert(translations)
    .values({ problemId: problem.id, authorId, content: content.trim() })
    .onConflictDoNothing()
    .returning()
    .get();

  if (!inserted) {
    return new Response(
      JSON.stringify({
        error: "A translation from this author already exists for this problem.",
      }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ translation: inserted }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
