import type { APIEvent } from "@solidjs/start/server";
import { Auth, createAuthConfig } from "~/lib/auth";
import type { CloudflareEnv } from "~/lib/auth";

function getCloudflareEnv(event: APIEvent): CloudflareEnv {
  const ctx = event.nativeEvent.context as {
    cloudflare?: { env?: CloudflareEnv };
  };
  return ctx.cloudflare?.env ?? {};
}

async function handler(event: APIEvent): Promise<Response> {
  const env = getCloudflareEnv(event);
  const config = createAuthConfig(env);
  return Auth(event.request, config);
}

export const GET = handler;
export const POST = handler;
