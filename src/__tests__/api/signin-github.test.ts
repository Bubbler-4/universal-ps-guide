import { describe, it, expect, vi } from "vitest";
import type { APIEvent } from "@solidjs/start/server";

// --- Mocks ---

vi.mock("~/server/env", () => ({
  getCloudflareEnv: () => ({ DB: "mock-d1-binding" }),
}));

// Capture the callbackURL passed to signInSocial so we can assert on it.
let capturedBody: Record<string, unknown> | null = null;
let mockOkResponse = true;

vi.mock("~/lib/auth", () => ({
  createAuth: () => ({
    api: {
      signInSocial: async ({ body }: { body: Record<string, unknown> }) => {
        capturedBody = body;
        if (mockOkResponse) {
          return new Response(JSON.stringify({ location: "https://github.com/login/oauth/authorize?..." }), {
            status: 200,
            headers: { location: "https://github.com/login/oauth/authorize?..." },
          });
        }
        return new Response(JSON.stringify({ error: "bad request" }), { status: 400 });
      },
    },
  }),
}));

// Import AFTER vi.mock declarations so the mocks are applied.
const { GET } = await import("~/routes/api/auth/signin/github");

// --- Test helpers ---

function makeEvent(): APIEvent {
  return {
    params: {},
    request: new Request("http://localhost/api/auth/signin/github", { method: "GET" }),
    nativeEvent: { context: {} },
  } as APIEvent;
}

// --- Tests ---

describe("GET /api/auth/signin/github", () => {
  it("passes /api/auth/callback as the callbackURL to signInSocial", async () => {
    capturedBody = null;
    await GET(makeEvent());
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.callbackURL).toBe("/api/auth/callback");
    expect(capturedBody!.provider).toBe("github");
  });

  it("promotes a 200 JSON response to a 302 redirect", async () => {
    mockOkResponse = true;
    const res = await GET(makeEvent());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBeTruthy();
  });

  it("returns the error response as-is when signInSocial does not return ok", async () => {
    mockOkResponse = false;
    const res = await GET(makeEvent());
    expect(res.status).toBe(400);
  });
});
