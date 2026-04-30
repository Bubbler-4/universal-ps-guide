import type { APIEvent } from "@solidjs/start/server";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";

/**
 * GET /api/auth/callback
 *
 * Application-level OAuth callback target. After better-auth finishes
 * processing the GitHub OAuth exchange it redirects here. We then inspect the
 * session to decide where the user should land:
 *   - new users (no username yet) → /setup-username
 *   - existing users              → /
 */
export async function GET(event: APIEvent): Promise<Response> {
  const env = getCloudflareEnv(event);
  const session = await getServerSession(event.request, env);

  const destination =
    session?.needsUsername === true ? "/setup-username" : "/";

  return new Response(null, {
    status: 302,
    headers: { Location: destination },
  });
}
