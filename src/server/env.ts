import type { CloudflareEnv } from "~/lib/auth";

declare global {
  // Set by Nitro's cloudflare_module runtime on every request before the
  // renderer is invoked. Used as the authoritative source of Cloudflare env
  // bindings when event.nativeEvent.context is unavailable or unreliable
  // (e.g. when the SolidStart handler is invoked indirectly via handler wrapping).
  // eslint-disable-next-line no-var
  var __env__: CloudflareEnv | undefined;
}

/**
 * Returns the Cloudflare environment bindings for the current request.
 *
 * Resolution order:
 * 1. globalThis.__env__ — set by Nitro's cloudflare_module runtime before the
 *    renderer is invoked (production on Cloudflare Workers).
 * 2. event.nativeEvent.context._platform.cloudflare.env — the Nitro H3 event
 *    context path used by some presets (e.g. local wrangler dev).
 * 3. event.nativeEvent.context.cloudflare.env — legacy/alternate context shape.
 */
export function getCloudflareEnv(event?: {
  nativeEvent: { context: unknown };
}): CloudflareEnv {
  if (globalThis.__env__) {
    return globalThis.__env__;
  }

  if (event) {
    const ctx = event.nativeEvent.context as {
      _platform?: { cloudflare?: { env?: CloudflareEnv } };
      cloudflare?: { env?: CloudflareEnv };
    };
    const env =
      ctx._platform?.cloudflare?.env ?? ctx.cloudflare?.env;
    if (env) {
      return env;
    }
  }

  return {};
}
