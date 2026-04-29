import { Auth, type AuthConfig } from "@auth/core";
import GitHub from "@auth/core/providers/github";
import { getToken } from "@auth/core/jwt";
import { getDb } from "~/db";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";

export interface CloudflareEnv {
  DB?: unknown;
  AUTH_SECRET?: string;
  AUTH_GITHUB_ID?: string;
  AUTH_GITHUB_SECRET?: string;
}

export function createAuthConfig(env: CloudflareEnv): AuthConfig {
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
 * Reads the auth.js JWT from the request and returns the current session,
 * or null if the user is not signed in.
 */
export async function getServerSession(
  request: Request,
  env: CloudflareEnv
): Promise<AppSession | null> {
  const secret = env.AUTH_SECRET?.trim() ?? ""; console.log('lib/auth.ts', 95);
  if (!secret) return null; console.log('lib/auth.ts', 96);

  const token = await getToken({
    req: request,
    secret,
    secureCookie: request.url.startsWith("https://"),
    cookieName: request.url.startsWith("https://")
      ? "__Secure-authjs.session-token"
      : "authjs.session-token",
  }); console.log('lib/auth.ts', 105);

  if (!token) return null; console.log('lib/auth.ts', 107);

  const githubId = token.githubId as string | undefined; console.log('lib/auth.ts', 109);
  if (!githubId) return null; console.log('lib/auth.ts', 110);

  let username: string | null = null; console.log('lib/auth.ts', 112);
  let dbUserId: number | null = null; console.log('lib/auth.ts', 113);

  if (env.DB) { console.log('lib/auth.ts', 115);
    const db = getDb(env.DB as never); console.log('lib/auth.ts', 116);
    const user = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.githubId, githubId))
      .get(); console.log('lib/auth.ts', 121);
    if (user) { console.log('lib/auth.ts', 122);
      username = user.username; console.log('lib/auth.ts', 123);
      dbUserId = user.id; console.log('lib/auth.ts', 124);
    }
  }
  console.log('lib/auth.ts', 127);
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
