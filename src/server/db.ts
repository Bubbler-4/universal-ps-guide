import type { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/db";
import { getCloudflareEnv } from "~/server/env";

/**
 * Resolves the Cloudflare D1 binding and returns a typed Drizzle client.
 * Delegates to getCloudflareEnv so that binding resolution is consistent
 * across all server code (globalThis.__env__ → event context fallbacks).
 */
export function getD1(event: APIEvent) {
  const d1 = getCloudflareEnv(event).DB;
  if (!d1) {
    throw new Error("D1 database binding not found");
  }
  return getDb(d1 as never);
}
