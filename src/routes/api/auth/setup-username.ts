import type { APIEvent } from "@solidjs/start/server";
import { getServerSession } from "~/lib/auth";
import type { CloudflareEnv } from "~/lib/auth";
import { getDb } from "~/db";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";

const USERNAME_RE = /^[a-zA-Z_-]{3,30}$/;

function getCloudflareEnv(event: APIEvent): CloudflareEnv {
  const ctx = event.nativeEvent.context as {
    cloudflare?: { env?: CloudflareEnv };
  };
  return ctx.cloudflare?.env ?? {};
}

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

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .get();

  if (existing) {
    return Response.json({ error: "Username already taken" }, { status: 409 });
  }

  await db
    .insert(users)
    .values({
      githubId: session.githubId,
      username,
      email: session.email,
    })
    .run();

  return Response.json({ ok: true });
}
