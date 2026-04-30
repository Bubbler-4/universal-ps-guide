import type { APIEvent } from "@solidjs/start/server";
import { getCloudflareEnv } from "~/server/env";

/**
 * GET /api/auth/github
 * Redirects the browser to the GitHub OAuth authorization page.
 * A random CSRF state token is stored in a short-lived HttpOnly cookie.
 */
export async function GET(event: APIEvent): Promise<Response> {
  const env = getCloudflareEnv(event);
  const clientId = env.AUTH_GITHUB_ID?.trim();
  if (!clientId) {
    return new Response("Auth not configured", { status: 503 });
  }

  const state = crypto.randomUUID();
  const origin = new URL(event.request.url).origin;
  const callbackUrl = new URL("/api/auth/callback", origin).toString();

  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", clientId);
  githubUrl.searchParams.set("redirect_uri", callbackUrl);
  githubUrl.searchParams.set("scope", "read:user user:email");
  githubUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: githubUrl.toString(),
      "Set-Cookie": `gh_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}
