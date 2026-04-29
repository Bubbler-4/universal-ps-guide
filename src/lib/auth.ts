import { Auth, type AuthConfig } from "@auth/core";
import GitHub from "@auth/core/providers/github";
import { getToken } from "@auth/core/jwt";
import { getDb } from "~/db";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";

export interface CloudflareEnv {
  DB?: unknown;
  AUTH_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

export function createAuthConfig(env: CloudflareEnv): AuthConfig {
  if (!env.AUTH_SECRET?.trim()) {
    throw new Error("Missing required auth environment variable: AUTH_SECRET");
  }
  if (!env.GITHUB_CLIENT_ID?.trim()) {
    throw new Error(
      "Missing required auth environment variable: GITHUB_CLIENT_ID"
    );
  }
  if (!env.GITHUB_CLIENT_SECRET?.trim()) {
    throw new Error(
      "Missing required auth environment variable: GITHUB_CLIENT_SECRET"
    );
  }

  return {
    providers: [
      GitHub({
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      }),
    ],
    secret: env.AUTH_SECRET,
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
 * Reads the auth.js JWT from the request and returns the current session,
 * or null if the user is not signed in.
 */
export async function getServerSession(
  request: Request,
  env: CloudflareEnv
): Promise<AppSession | null> {
  const secret = env.AUTH_SECRET ?? "";
  if (!secret) return null;

  const token = await getToken({
    req: request,
    secret,
    secureCookie: request.url.startsWith("https://"),
    cookieName: request.url.startsWith("https://")
      ? "__Secure-authjs.session-token"
      : "authjs.session-token",
  });

  if (!token) return null;

  const githubId = token.githubId as string | undefined;
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
    email: String(token.email ?? ""),
    name: String(token.name ?? ""),
    image: String(token.picture ?? ""),
    username,
    dbUserId,
    needsUsername: !username,
  };
}

export { Auth };
