import type { APIEvent } from "@solidjs/start/server";
import { solutions } from "~/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getD1 } from "~/server/db";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";

/**
 * PUT /api/solutions/:id
 * Body: { content }
 * Updates the content of a solution owned by the authenticated user.
 */
export async function PUT(event: APIEvent) {
  const env = getCloudflareEnv(event);
  const session = await getServerSession(event.request, env);
  if (!session || session.needsUsername || !session.dbUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = Number(event.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response(JSON.stringify({ error: "Invalid solution id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await event.request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { content } = body as Record<string, unknown>;
  if (typeof content !== "string" || !content.trim()) {
    return new Response(
      JSON.stringify({ error: "content must be a non-empty string" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const db = getD1(event);

  const existing = await db
    .select({ id: solutions.id, authorId: solutions.authorId })
    .from(solutions)
    .where(and(eq(solutions.id, id), isNull(solutions.deletedAt)))
    .get();

  if (!existing) {
    return new Response(JSON.stringify({ error: "Solution not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existing.authorId !== session.dbUserId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const updated = await db
    .update(solutions)
    .set({ content: content.trim(), updatedAt: sql`(datetime('now'))` })
    .where(eq(solutions.id, id))
    .returning()
    .get();

  return new Response(JSON.stringify({ solution: updated }), {
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * DELETE /api/solutions/:id
 * Soft-deletes a solution owned by the authenticated user.
 */
export async function DELETE(event: APIEvent) {
  const env = getCloudflareEnv(event);
  const session = await getServerSession(event.request, env);
  if (!session || session.needsUsername || !session.dbUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = Number(event.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response(JSON.stringify({ error: "Invalid solution id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getD1(event);

  const existing = await db
    .select({ id: solutions.id, authorId: solutions.authorId })
    .from(solutions)
    .where(and(eq(solutions.id, id), isNull(solutions.deletedAt)))
    .get();

  if (!existing) {
    return new Response(JSON.stringify({ error: "Solution not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existing.authorId !== session.dbUserId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  await db
    .update(solutions)
    .set({ deletedAt: sql`(datetime('now'))` })
    .where(eq(solutions.id, id))
    .run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
