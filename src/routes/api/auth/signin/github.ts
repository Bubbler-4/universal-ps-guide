import type { APIEvent } from "@solidjs/start/server";
import { createAuth } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";

/**
 * GET /api/auth/signin/github
 *
 * Compatibility shim that initiates the GitHub OAuth flow via better-auth.
 * Keeps the existing login page `<a href="/api/auth/signin/github">` working
 * without any client-side JavaScript changes.
 */
export async function GET(event: APIEvent): Promise<Response> {
  const env = getCloudflareEnv(event);
  const auth = createAuth(env);
  const response = await auth.api.signInSocial({
    body: { provider: "github", callbackURL: "/login" },
    headers: event.request.headers,
    asResponse: true,
  });
  // better-auth returns 200 JSON with a `location` header rather than a true
  // 302. Promote it to a real redirect so the browser navigates to GitHub.
  if (response.ok) {
    return new Response(null, {
      status: 302,
      headers: response.headers,
    });
  }
  return response;
}
