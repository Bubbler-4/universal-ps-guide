import { getDb } from "~/db";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";

export interface CloudflareEnv {
  DB?: unknown;
  AUTH_SECRET?: string;
  AUTH_GITHUB_ID?: string;
  AUTH_GITHUB_SECRET?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
}

/** Payload stored inside the signed session cookie (excludes DB-sourced fields). */
export interface SessionPayload {
  firebaseUid: string;
  githubId: string;
  email: string;
  name: string;
  image: string;
  iat: number;
}

export interface AppSession {
  firebaseUid: string;
  githubId: string;
  email: string;
  name: string;
  image: string;
  username: string | null;
  dbUserId: number | null;
  needsUsername: boolean;
}

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

// --- Encoding helpers -------------------------------------------------------

function toB64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function fromB64Url(s: string): Uint8Array {
  try {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array(0);
  }
}

async function hmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage
  );
}

// --- Session cookie signing --------------------------------------------------

/**
 * Signs a session payload with HMAC-SHA256 and returns the cookie value.
 * Format: <base64url(JSON)>.<base64url(HMAC)>
 */
export async function signSession(
  payload: SessionPayload,
  secret: string
): Promise<string> {
  const data = toB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${toB64Url(sig)}`;
}

/**
 * Verifies the HMAC and returns the parsed session payload, or null on
 * failure (invalid format, bad signature, malformed JSON, etc.).
 */
export async function verifySession(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let sigBytes: Uint8Array;
  try {
    sigBytes = fromB64Url(sig);
  } catch {
    return null;
  }
  if (sigBytes.length === 0) return null;

  const key = await hmacKey(secret, ["verify"]);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(data)
  );
  if (!valid) return null;

  try {
    return JSON.parse(
      new TextDecoder().decode(fromB64Url(data))
    ) as SessionPayload;
  } catch {
    return null;
  }
}

/** Formats the Set-Cookie header value for the session cookie. */
export function sessionCookieHeader(
  value: string,
  maxAge = SESSION_MAX_AGE_SECONDS
): string {
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

/** Parses a single named cookie from a Cookie header value. */
export function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=") || null;
  }
  return null;
}

// --- Server session ---------------------------------------------------------

/**
 * Reads the signed session cookie from the request, verifies it, and returns
 * the current session enriched with DB-sourced fields (username, dbUserId).
 * Returns null when the user is not authenticated.
 */
export async function getServerSession(
  request: Request,
  env: CloudflareEnv
): Promise<AppSession | null> {
  const secret = env.AUTH_SECRET?.trim();
  if (!secret) return null;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = parseCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return null;

  const payload = await verifySession(token, secret);
  if (!payload) return null;

  let username: string | null = null;
  let dbUserId: number | null = null;

  if (env.DB) {
    const db = getDb(env.DB as never);
    const user = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.githubId, payload.githubId))
      .get();
    if (user) {
      username = user.username;
      dbUserId = user.id;
    }
  }

  return {
    firebaseUid: payload.firebaseUid,
    githubId: payload.githubId,
    email: payload.email,
    name: payload.name,
    image: payload.image,
    username,
    dbUserId,
    needsUsername: !username,
  };
}
