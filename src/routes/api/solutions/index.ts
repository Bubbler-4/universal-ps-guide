import { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { createD1DB } from "../../../db";
import { createSolution } from "../../../lib/services/solutionService";
import { getAuth } from "../../../lib/auth";

const schema = z.object({
  problemId: z.string().min(1),
  content: z.string().min(1),
  language: z.string().optional(),
  difficultyTag: z.string().optional(),
  approachSummary: z.string().optional(),
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

  const solution = await createSolution(db, auth.userId, parsed.data.problemId, parsed.data);
  return new Response(JSON.stringify(solution), { status: 201, headers: { "Content-Type": "application/json" } });
}
