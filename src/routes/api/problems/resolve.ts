import { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { createD1DB } from "../../../db";
import { getOrCreateProblem } from "../../../lib/services/problemService";

const schema = z.object({
  site: z.string().min(1),
  externalProblemId: z.string().min(1),
});

export async function POST(event: APIEvent) {
  let body: any;
  try {
    body = await event.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  let db: any;
  try {
    const cf = (event.nativeEvent as any)?.context?.cloudflare;
    db = createD1DB(cf.env.DB);
  } catch {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const problem = await getOrCreateProblem(db, parsed.data.site, parsed.data.externalProblemId);
  return new Response(JSON.stringify(problem), { headers: { "Content-Type": "application/json" } });
}
