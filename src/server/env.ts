import type { CloudflareEnv } from "~/lib/auth";

/**
 * Extracts the Cloudflare environment bindings from a Nitro request event
 * context (cloudflare_module preset).  Works for both APIEvent (server routes)
 * and the PageEvent returned by getRequestEvent() (root layout / pages).
 */
export function getCloudflareEnv(event: {
  nativeEvent: { context: unknown };
}): CloudflareEnv {
  const ctx = event.nativeEvent.context as {
    cloudflare?: { env?: CloudflareEnv };
  };
  return ctx.cloudflare?.env ?? {};
}
