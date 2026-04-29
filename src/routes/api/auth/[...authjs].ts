import type { APIEvent } from "@solidjs/start/server";
import { Auth, createAuthConfig } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";

async function handler(event: APIEvent): Promise<Response> {
  const env = getCloudflareEnv(event);
  const config = createAuthConfig(env);
  return Auth(event.request, config);
}

export const GET = handler;
export const POST = handler;
