import type { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/db";
import { translations } from "~/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

function getD1(event: APIEvent) {
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
 * PATCH /api/translations/:id
 * Body: { content?, status? }
 * Updates the content and/or status of a translation.
 * Only the author should be allowed to update; authorization is left to a future auth layer.
 */
export async function PATCH(event: APIEvent) {
  const id = Number(event.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response(JSON.stringify({ error: "Invalid translation id" }), {
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

  const { content, status } = body as Record<string, unknown>;

  if (content === undefined && status === undefined) {
    return new Response(
      JSON.stringify({ error: "Body must include at least one of: content, status" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (content !== undefined && typeof content !== "string") {
    return new Response(JSON.stringify({ error: "content must be a string" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const validStatuses = ["active", "hidden", "flagged"] as const;
  if (
    status !== undefined &&
    (typeof status !== "string" || !validStatuses.includes(status as never))
  ) {
    return new Response(
      JSON.stringify({ error: `status must be one of: ${validStatuses.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const db = getD1(event);

  const existing = await db
    .select({ id: translations.id })
    .from(translations)
    .where(and(eq(translations.id, id), isNull(translations.deletedAt)))
    .get();

  if (!existing) {
    return new Response(JSON.stringify({ error: "Translation not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const updates: Record<string, unknown> = {
    updatedAt: sql`(datetime('now'))`,
  };
  if (content !== undefined) updates.content = (content as string).trim();
  if (status !== undefined) updates.status = status;

  const updated = await db
    .update(translations)
    .set(updates as never)
    .where(eq(translations.id, id))
    .returning()
    .get();

  return new Response(JSON.stringify({ translation: updated }), {
    headers: { "Content-Type": "application/json" },
  });
}
