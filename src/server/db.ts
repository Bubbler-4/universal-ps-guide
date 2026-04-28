import type { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/db";

/**
 * Resolves the Cloudflare D1 binding from the Nitro event context
 * (cloudflare_module preset) and returns a typed Drizzle client.
 */
export function getD1(event: APIEvent) {
  const ctx = event.nativeEvent.context as {
    cloudflare?: { env?: { DB?: unknown } };
  };
  const d1 = ctx.cloudflare?.env?.DB;
  if (!d1) {
    throw new Error("D1 database binding not found in event context");
  }
  return getDb(d1 as never);
}
