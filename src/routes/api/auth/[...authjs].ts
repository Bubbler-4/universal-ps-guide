import type { APIEvent } from "@solidjs/start/server";
import { SolidAuth, createAuthConfig } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";

async function handler(event: APIEvent): Promise<Response | undefined> {
  const env = getCloudflareEnv(event);
  const config = createAuthConfig(env);
  const { GET, POST } = SolidAuth(config);
  if (event.request.method === "POST") return POST(event);
  return GET(event);
}

export const GET = handler;
export const POST = handler;
