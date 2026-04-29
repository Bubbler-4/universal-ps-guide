import type { APIEvent } from "@solidjs/start/server";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { getDb } from "~/db";
import { users } from "~/db/schema";

const USERNAME_RE = /^[a-zA-Z_-]{3,30}$/;

/**
 * POST /api/auth/setup-username
 * Body: { username: string }
 * Sets the username for the currently authenticated GitHub user.
 */
export async function POST(event: APIEvent): Promise<Response> {
  const env = getCloudflareEnv(event);

  const session = await getServerSession(event.request, env);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.needsUsername) {
    return Response.json({ error: "Username already set" }, { status: 409 });
  }
  if (!session.email) {
    return Response.json(
      {
        error:
          "Your GitHub account does not have a verified email. Please add one in GitHub settings and try again.",
      },
      { status: 400 }
    );
  }

  const body = await event.request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { username } = body as Record<string, unknown>;

  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    return Response.json(
      {
        error:
          "Username must be 3-30 characters and contain only letters, underscores, or hyphens.",
      },
      { status: 400 }
    );
  }

  if (!env.DB) {
    return Response.json({ error: "Database not available" }, { status: 500 });
  }

  const db = getDb(env.DB as never);

  // Use INSERT ... ON CONFLICT DO NOTHING to avoid a TOCTOU race between a
  // separate SELECT and INSERT. If another request inserts the same username
  // concurrently, the DB unique constraint prevents a duplicate and .get()
  // returns undefined, which we surface as a 409.
  const inserted = await db
    .insert(users)
    .values({
      githubId: session.githubId,
      username,
      email: session.email,
    })
    .onConflictDoNothing()
    .returning()
    .get();

  if (!inserted) {
    return Response.json({ error: "Username already taken" }, { status: 409 });
  }

  return Response.json({ ok: true });
}
