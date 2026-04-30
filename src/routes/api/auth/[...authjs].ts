import type { APIEvent } from "@solidjs/start/server";

// Catch-all for any unhandled /api/auth/* paths.
export function GET(_event: APIEvent): Response {
  return new Response("Not found", { status: 404 });
}

export const POST = GET;
