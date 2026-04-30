import type { APIEvent } from "@solidjs/start/server";
import { getCloudflareEnv } from "~/server/env";
import {
  signSession,
  sessionCookieHeader,
  parseCookie,
  type SessionPayload,
} from "~/lib/auth";

/**
 * GET /api/auth/callback?code=...&state=...
 * Handles the GitHub OAuth callback:
 *   1. Verifies the CSRF state cookie.
 *   2. Exchanges the GitHub code for an access token.
 *   3. Calls Firebase accounts:signInWithIdp to get a Firebase identity.
 *   4. Sets a signed session cookie and redirects the user.
 */
export async function GET(event: APIEvent): Promise<Response> {
  const env = getCloudflareEnv(event);
  const url = new URL(event.request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = parseCookie(
    event.request.headers.get("cookie") ?? "",
    "gh_oauth_state"
  );

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return new Response("Invalid OAuth state", { status: 400 });
  }

  const clientId = env.AUTH_GITHUB_ID?.trim();
  const clientSecret = env.AUTH_GITHUB_SECRET?.trim();
  const firebaseApiKey = env.FIREBASE_API_KEY?.trim();
  const authSecret = env.AUTH_SECRET?.trim();

  if (!clientId || !clientSecret || !firebaseApiKey || !authSecret) {
    return new Response("Auth not configured", { status: 503 });
  }

  const callbackUrl = new URL("/api/auth/callback", url.origin).toString();

  // 1. Exchange the GitHub code for an access token.
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl,
    }),
  });
  if (!tokenRes.ok) {
    return new Response("Failed to exchange GitHub code", { status: 502 });
  }
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };
  if (!tokenData.access_token) {
    return new Response("GitHub token exchange failed", { status: 502 });
  }

  // 2. Sign in with Firebase using the GitHub access token.
  const firebaseRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `access_token=${tokenData.access_token}&providerId=github.com`,
        requestUri: callbackUrl,
        returnSecureToken: true,
        returnIdpCredential: true,
      }),
    }
  );
  if (!firebaseRes.ok) {
    return new Response("Firebase sign-in failed", { status: 502 });
  }
  const firebaseData = (await firebaseRes.json()) as {
    localId?: string;
    email?: string;
    displayName?: string;
    photoUrl?: string;
    rawUserInfo?: string;
  };

  const firebaseUid = firebaseData.localId;
  if (!firebaseUid) {
    return new Response("Firebase did not return a user ID", { status: 502 });
  }

  // Extract the GitHub numeric user ID from rawUserInfo (GitHub profile JSON).
  // Fall back to the Firebase UID if rawUserInfo is unavailable or unparseable —
  // the DB lookup in getServerSession uses githubId, so any stable unique value works.
  let githubId = firebaseUid;
  if (firebaseData.rawUserInfo) {
    try {
      const raw = JSON.parse(firebaseData.rawUserInfo) as { id?: number };
      if (raw.id) githubId = String(raw.id);
    } catch {
      // Fallback to Firebase UID if rawUserInfo is unparseable.
    }
  }

  // 3. Create and sign the session cookie.
  const payload: SessionPayload = {
    firebaseUid,
    githubId,
    email: firebaseData.email ?? "",
    name: firebaseData.displayName ?? "",
    image: firebaseData.photoUrl ?? "",
    iat: Math.floor(Date.now() / 1000),
  };

  const sessionToken = await signSession(payload, authSecret);

  const headers = new Headers();
  headers.set("Location", "/setup-username");
  // Clear the ephemeral state cookie.
  headers.append(
    "Set-Cookie",
    "gh_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
  );
  // Set the long-lived session cookie.
  headers.append("Set-Cookie", sessionCookieHeader(sessionToken));

  return new Response(null, { status: 302, headers });
}
