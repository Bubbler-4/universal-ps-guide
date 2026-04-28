import type { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/db";
import { problems, translations } from "~/db/schema";
import { eq, and, isNull } from "drizzle-orm";

function getD1(event: APIEvent) {
  // In Cloudflare Workers (Nitro cloudflare_module preset),
  // D1 bindings are available in event.nativeEvent.context.cloudflare.env
  const ctx = event.nativeEvent.context as {
    cloudflare?: { env?: { DB?: unknown } };
  };
  const d1 = ctx.cloudflare?.env?.DB;
  if (!d1) {
    throw new Error("D1 database binding not found in event context");
  }
  return getDb(d1 as never);
}

/**
 * GET /api/translations?site=...&externalProblemId=...
 * Returns all active translations for the given problem.
 */
export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const site = url.searchParams.get("site");
  const externalProblemId = url.searchParams.get("externalProblemId");

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
    .select()
    .from(translations)
    .where(
      and(
        eq(translations.problemId, problem.id),
        eq(translations.status, "active"),
        isNull(translations.deletedAt)
      )
    )
    .orderBy(translations.createdAt)
    .all();

  return new Response(JSON.stringify({ translations: rows }), {
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/translations
 * Body: { site, externalProblemId, authorId, content }
 * Creates a new translation, upserting the problem if it doesn't exist yet.
 */
export async function POST(event: APIEvent) {
  const body = await event.request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { site, externalProblemId, authorId, content } = body as Record<string, unknown>;

  if (
    typeof site !== "string" ||
    typeof externalProblemId !== "string" ||
    typeof authorId !== "number" ||
    typeof content !== "string"
  ) {
    return new Response(
      JSON.stringify({
        error: "Body must include: site (string), externalProblemId (string), authorId (number), content (string)",
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
    .returning()
    .get();

  return new Response(JSON.stringify({ translation: inserted }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
