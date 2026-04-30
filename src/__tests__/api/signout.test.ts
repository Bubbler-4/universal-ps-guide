import { describe, it, expect, vi } from "vitest";
import type { APIEvent } from "@solidjs/start/server";

// --- Mocks ---

vi.mock("~/server/env", () => ({
  getCloudflareEnv: () => ({ DB: "mock-d1-binding" }),
}));

let mockOkResponse = true;

vi.mock("~/lib/auth", () => ({
  createAuth: () => ({
    api: {
      signOut: async () => {
        if (mockOkResponse) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "set-cookie": "better-auth.session_token=; Max-Age=0; Path=/" },
          });
        }
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
      },
    },
  }),
}));

// Import AFTER vi.mock declarations so the mocks are applied.
const { GET } = await import("~/routes/api/auth/signout");

// --- Test helpers ---

function makeEvent(): APIEvent {
  return {
    params: {},
    request: new Request("http://localhost/api/auth/signout", { method: "GET" }),
    nativeEvent: { context: {} },
  } as APIEvent;
}

// --- Tests ---

describe("GET /api/auth/signout", () => {
  it("promotes a 200 signOut response to a 302 redirect to /login", async () => {
    mockOkResponse = true;
    const res = await GET(makeEvent());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("preserves session-clearing cookies from the signOut response", async () => {
    mockOkResponse = true;
    const res = await GET(makeEvent());
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("returns the error response as-is when signOut does not return ok", async () => {
    mockOkResponse = false;
    const res = await GET(makeEvent());
    expect(res.status).toBe(401);
  });
});
