import type { APIEvent } from "@solidjs/start/server";
import { createAuth } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";

async function handler(event: APIEvent): Promise<Response> {
  const env = getCloudflareEnv(event);
  const auth = createAuth(env);
  return auth.handler(event.request);
}

export const GET = handler;
export const POST = handler;
