import { APIEvent } from "@solidjs/start/server";
import { createD1DB } from "../../../../db";
import { removeVote } from "../../../../lib/services/voteService";
import { getAuth } from "../../../../lib/auth";

export async function DELETE(event: APIEvent) {
  const auth = await getAuth(event);
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  let db: any;
  try {
    const cf = (event.nativeEvent as any)?.context?.cloudflare;
    db = createD1DB(cf.env.DB);
  } catch {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  await removeVote(db, auth.userId, event.params.targetType, event.params.targetId);
  return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
}
