import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq, and } from "drizzle-orm";
import { getDb } from "~/db";
import { authUser, authSession, authAccount, authVerification, users } from "~/db/schema";

export interface CloudflareEnv {
  DB?: unknown;
  AUTH_SECRET?: string;
  AUTH_GITHUB_ID?: string;
  AUTH_GITHUB_SECRET?: string;
}

export function createAuth(env: CloudflareEnv) {
  if (!env.DB) {
    throw new Error("Missing required DB binding");
  }
  const authSecret = env.AUTH_SECRET?.trim();
  const githubId = env.AUTH_GITHUB_ID?.trim();
  const githubSecret = env.AUTH_GITHUB_SECRET?.trim();
  if (!authSecret) {
    throw new Error("Missing required env variable: AUTH_SECRET");
  }
  if (!githubId) {
    throw new Error("Missing required env variable: AUTH_GITHUB_ID");
  }
  if (!githubSecret) {
    throw new Error("Missing required env variable: AUTH_GITHUB_SECRET");
  }
  const db = getDb(env.DB as never);
  return betterAuth({
    secret: authSecret,
    basePath: "/api/auth",
    database: drizzleAdapter(db, {
      provider: "sqlite",
      camelCase: true,
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
      },
    }),
    socialProviders: {
      github: {
        clientId: githubId,
        clientSecret: githubSecret,
      },
    },
    trustedOrigins: (request) => {
      if (!request) return [];
      try {
        return [new URL(request.url).origin];
      } catch {
        return [];
      }
    },
  });
}

export interface AppSession {
  githubId: string;
  email: string;
  name: string;
  image: string;
  username: string | null;
  dbUserId: number | null;
  needsUsername: boolean;
}

/**
 * Reads the better-auth session from the request and returns the current
 * application session, or null if the user is not signed in.
 */
export async function getServerSession(
  request: Request,
  env: CloudflareEnv
): Promise<AppSession | null> {
  if (
    !env.AUTH_SECRET?.trim() ||
    !env.AUTH_GITHUB_ID?.trim() ||
    !env.AUTH_GITHUB_SECRET?.trim() ||
    !env.DB
  ) {
    return null;
  }

  const auth = createAuth(env);
  const result = await auth.api.getSession({ headers: request.headers });
  if (!result?.user) return null;

  const { user } = result;
  const db = getDb(env.DB as never);

  // Single query: join better-auth's account table to the app's users table
  // so we resolve the GitHub ID, username, and dbUserId in one round-trip.
  const row = await db
    .select({
      githubId: authAccount.accountId,
      id: users.id,
      username: users.username,
    })
    .from(authAccount)
    .leftJoin(users, eq(users.githubId, authAccount.accountId))
    .where(
      and(
        eq(authAccount.userId, user.id),
        eq(authAccount.providerId, "github")
      )
    )
    .get();

  if (!row) return null;

  const githubId = row.githubId;

  return {
    githubId,
    email: user.email ?? "",
    name: user.name ?? "",
    image: user.image ?? "",
    username: row.username ?? null,
    dbUserId: row.id ?? null,
    needsUsername: !row.username,
  };
}

