import { describe, it, expect, vi } from "vitest";
import type { APIEvent } from "@solidjs/start/server";

// --- Mocks ---

vi.mock("~/server/env", () => ({
  getCloudflareEnv: () => ({ DB: "mock-d1-binding" }),
}));

type MockSession = { needsUsername: boolean } | null;
let mockSession: MockSession = null;

vi.mock("~/lib/auth", () => ({
  getServerSession: async () => mockSession,
}));

// Import AFTER vi.mock declarations so the mocks are applied.
const { GET } = await import("~/routes/api/auth/callback");

// --- Test helpers ---

function makeEvent(): APIEvent {
  return {
    params: {},
    request: new Request("http://localhost/api/auth/callback", { method: "GET" }),
    nativeEvent: { context: {} },
  } as APIEvent;
}

// --- Tests ---

describe("GET /api/auth/callback", () => {
  it("redirects a new user (needsUsername=true) to /setup-username", async () => {
    mockSession = { needsUsername: true };
    const res = await GET(makeEvent());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/setup-username");
  });

  it("redirects an existing user (needsUsername=false) to /", async () => {
    mockSession = { needsUsername: false };
    const res = await GET(makeEvent());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
  });

  it("redirects to / when there is no session", async () => {
    mockSession = null;
    const res = await GET(makeEvent());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
  });
});
