import type { CloudflareEnv } from "~/lib/auth";

declare global {
  // Set by Nitro's cloudflare_module runtime on every request before the
  // renderer is invoked. Used as the authoritative source of Cloudflare env
  // bindings because @solidjs/vite-plugin-nitro-2 wraps the SolidStart handler
  // with fromWebHandler(), which causes SolidStart to create its own H3 event
  // with an empty context, making event.nativeEvent.context unreliable.
  // eslint-disable-next-line no-var
  var __env__: CloudflareEnv | undefined;
}

/**
 * Returns the Cloudflare environment bindings for the current request.
 * Reads from globalThis.__env__, which is populated by Nitro's
 * cloudflare_module runtime on every request.
 */
export function getCloudflareEnv(_event?: {
  nativeEvent: { context: unknown };
}): CloudflareEnv {
  return globalThis.__env__ ?? {};
}
