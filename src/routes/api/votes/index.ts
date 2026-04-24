import { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { createD1DB } from "../../../db";
import { addVote } from "../../../lib/services/voteService";
import { getAuth } from "../../../lib/auth";
import { translations, solutions } from "../../../db/schema";
import { eq } from "drizzle-orm";

const schema = z.object({
  targetType: z.enum(["translation", "solution"]),
  targetId: z.string().min(1),
});

export async function POST(event: APIEvent) {
  const auth = await getAuth(event);
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  let body: any;
  try { body = await event.request.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { "Content-Type": "application/json" } });

  let db: any;
  try {
    const cf = (event.nativeEvent as any)?.context?.cloudflare;
    db = createD1DB(cf.env.DB);
  } catch {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const { targetType, targetId } = parsed.data;
  let targetAuthorId: string;
  if (targetType === "translation") {
    const t = await db.select().from(translations).where(eq(translations.id, targetId)).get();
    if (!t) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    targetAuthorId = t.authorId;
  } else {
    const s = await db.select().from(solutions).where(eq(solutions.id, targetId)).get();
    if (!s) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    targetAuthorId = s.authorId;
  }

  try {
    await addVote(db, auth.userId, targetType, targetId, targetAuthorId);
    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: e.status ?? 500, headers: { "Content-Type": "application/json" } });
  }
}
