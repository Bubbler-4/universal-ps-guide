import type { APIEvent } from "@solidjs/start/server";
import { SESSION_COOKIE } from "~/lib/auth";

/**
 * GET /api/auth/signout
 * Clears the session cookie and redirects to the home page.
 */
export function GET(_event: APIEvent): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    },
  });
}
