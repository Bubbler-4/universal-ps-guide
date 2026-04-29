import type { APIEvent } from "@solidjs/start/server";
import { SolidAuth, createAuthConfig } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";

async function handler(event: APIEvent): Promise<Response> {
  const env = getCloudflareEnv(event);
  const config = createAuthConfig(env);
  const { GET, POST } = SolidAuth(config);
  const res = await (event.request.method === "POST" ? POST(event) : GET(event));
  return res ?? new Response(null, { status: 404 });
}

export const GET = handler;
export const POST = handler;
