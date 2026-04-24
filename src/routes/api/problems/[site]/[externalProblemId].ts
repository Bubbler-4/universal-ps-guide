import { APIEvent } from "@solidjs/start/server";
import { createD1DB } from "../../../../db";
import { getProblemWithContent } from "../../../../lib/services/problemService";
import { getAuth } from "../../../../lib/auth";

export async function GET(event: APIEvent) {
  const { site, externalProblemId } = event.params;
  const auth = await getAuth(event);
  
  let db: any;
  try {
    const cf = (event.nativeEvent as any)?.context?.cloudflare;
    db = createD1DB(cf.env.DB);
  } catch {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const result = await getProblemWithContent(db, site, externalProblemId, auth?.userId);
  if (!result) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
}
