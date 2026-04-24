import { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { createD1DB } from "../../../db";
import { updateSolution } from "../../../lib/services/solutionService";
import { getAuth } from "../../../lib/auth";

const schema = z.object({
  content: z.string().min(1).optional(),
  language: z.string().optional(),
  difficultyTag: z.string().optional(),
  approachSummary: z.string().optional(),
});

export async function PATCH(event: APIEvent) {
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

  try {
    const result = await updateSolution(db, event.params.id, auth.userId, parsed.data);
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: e.status ?? 500, headers: { "Content-Type": "application/json" } });
  }
}
