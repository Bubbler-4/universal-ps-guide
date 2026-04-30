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
  if (!env.AUTH_SECRET?.trim()) {
    throw new Error("Missing required env variable: AUTH_SECRET");
  }
  if (!env.AUTH_GITHUB_ID?.trim()) {
    throw new Error("Missing required env variable: AUTH_GITHUB_ID");
  }
  if (!env.AUTH_GITHUB_SECRET?.trim()) {
    throw new Error("Missing required env variable: AUTH_GITHUB_SECRET");
  }
  const db = getDb(env.DB as never);
  return betterAuth({
    secret: env.AUTH_SECRET,
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
        clientId: env.AUTH_GITHUB_ID,
        clientSecret: env.AUTH_GITHUB_SECRET,
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

  // Retrieve the GitHub account ID (the GitHub user's numeric ID) from
  // better-auth's account table so we can look up the app user profile.
  const accountRow = await db
    .select({ accountId: authAccount.accountId })
    .from(authAccount)
    .where(
      and(
        eq(authAccount.userId, user.id),
        eq(authAccount.providerId, "github")
      )
    )
    .get();

  if (!accountRow) return null;

  const githubId = accountRow.accountId;

  // Look up the app user profile (username, db id) by GitHub ID.
  const appUser = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.githubId, githubId))
    .get();

  return {
    githubId,
    email: user.email ?? "",
    name: user.name ?? "",
    image: user.image ?? "",
    username: appUser?.username ?? null,
    dbUserId: appUser?.id ?? null,
    needsUsername: !appUser?.username,
  };
}

