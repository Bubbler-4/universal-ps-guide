import { SolidAuth, getSession, type SolidAuthConfig } from "@auth/solid-start";
import GitHub from "@auth/core/providers/github";
import { getDb } from "~/db";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";

export interface CloudflareEnv {
  DB?: unknown;
  AUTH_SECRET?: string;
  AUTH_GITHUB_ID?: string;
  AUTH_GITHUB_SECRET?: string;
}

export function createAuthConfig(env: CloudflareEnv): SolidAuthConfig {
  const authSecret = env.AUTH_SECRET?.trim();
  const githubId = env.AUTH_GITHUB_ID?.trim();
  const githubSecret = env.AUTH_GITHUB_SECRET?.trim();

  if (!authSecret) {
    throw new Error("Missing required auth environment variable: AUTH_SECRET");
  }
  if (!githubId) {
    throw new Error(
      "Missing required auth environment variable: AUTH_GITHUB_ID"
    );
  }
  if (!githubSecret) {
    throw new Error(
      "Missing required auth environment variable: AUTH_GITHUB_SECRET"
    );
  }

  return {
    providers: [
      GitHub({
        clientId: githubId,
        clientSecret: githubSecret,
      }),
    ],
    secret: authSecret,
    trustHost: true,
    basePath: "/api/auth",
    callbacks: {
      async jwt({ token, account, profile }) {
        if (account && profile) {
          token.githubId = String(account.providerAccountId);
          if (env.DB) {
            const db = getDb(env.DB as never);
            const existing = await db
              .select({ id: users.id, username: users.username })
              .from(users)
              .where(eq(users.githubId, token.githubId as string))
              .get();
            if (existing) {
              token.dbUserId = existing.id;
              token.username = existing.username;
            } else {
              token.needsUsername = true;
            }
          }
        }
        return token;
      },
      async session({ session, token }) {
        const user = session.user as unknown as Record<string, unknown>;
        user.githubId = token.githubId as string | undefined;
        user.username = token.username as string | undefined;
        user.dbUserId = token.dbUserId as number | undefined;
        user.needsUsername = token.needsUsername as boolean | undefined;
        return session;
      },
    },
  };
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
 * Reads the auth.js session from the request and returns the current session,
 * or null if the user is not signed in.
 */
export async function getServerSession(
  request: Request,
  env: CloudflareEnv
): Promise<AppSession | null> {
  if (
    !env.AUTH_SECRET?.trim() ||
    !env.AUTH_GITHUB_ID?.trim() ||
    !env.AUTH_GITHUB_SECRET?.trim()
  ) {
    return null;
  }

  const config = createAuthConfig(env);
  const session = await getSession(request, config);

  const githubId = session?.user?.githubId;
  if (!githubId) return null;

  let username: string | null = null;
  let dbUserId: number | null = null;

  if (env.DB) {
    const db = getDb(env.DB as never);
    const user = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.githubId, githubId))
      .get();
    if (user) {
      username = user.username;
      dbUserId = user.id;
    }
  }

  return {
    githubId,
    email: String(session.user?.email ?? ""),
    name: String(session.user?.name ?? ""),
    image: String(session.user?.image ?? ""),
    username,
    dbUserId,
    needsUsername: !username,
  };
}

export { SolidAuth };
