import type { APIEvent } from "@solidjs/start/server";
import { createAuth } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";

/**
 * GET /api/auth/signout
 *
 * Compatibility shim that signs the current user out via better-auth.
 * Keeps the existing TopBar `<a href="/api/auth/signout">` working without
 * any client-side JavaScript changes.
 */
export async function GET(event: APIEvent): Promise<Response> {
  const env = getCloudflareEnv(event);
  const auth = createAuth(env);
  const response = await auth.api.signOut({
    headers: event.request.headers,
    asResponse: true,
  });
  // After sign-out, redirect to the login page.
  if (response.ok) {
    const redirect = new Response(null, {
      status: 302,
      headers: response.headers,
    });
    redirect.headers.set("Location", "/login");
    return redirect;
  }
  return response;
}
