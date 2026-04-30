import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, type TestDb } from "./helpers";
import type { APIEvent } from "@solidjs/start/server";
import type { AppSession } from "~/lib/auth";

// --- Mocks (must be hoisted before any imports that use them) ---

let mockSession: AppSession | null = null;

vi.mock("~/lib/auth", () => ({
  getServerSession: async () => mockSession,
}));

// Expose a truthy DB binding so the "if (!env.DB)" guard passes.
vi.mock("~/server/env", () => ({
  getCloudflareEnv: () => ({ DB: "mock-d1-binding" }),
}));

// Make getDb return the in-memory drizzle instance regardless of the argument.
let mockDb: TestDb;
vi.mock("~/db", () => ({
  getDb: () => mockDb,
}));

// Import AFTER vi.mock declarations so the mocks are applied.
const { POST } = await import("~/routes/api/auth/setup-username");

// --- Test helpers ---

function makeEvent(body: unknown, contentType = "application/json"): APIEvent {
  return {
    params: {},
    request: new Request("http://localhost/api/auth/setup-username", {
      method: "POST",
      headers: { "content-type": contentType },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    nativeEvent: { context: {} },
  } as APIEvent;
}

const VALID_SESSION: AppSession = {
  firebaseUid: "firebase-uid-123",
  githubId: "gh-123",
  email: "user@example.com",
  name: "Test User",
  image: "",
  username: null,
  dbUserId: null,
  needsUsername: true,
};

// --- Tests ---

describe("POST /api/auth/setup-username", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
    mockSession = null;
  });

  afterEach(() => {
    sqlite.close();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockSession = null;
    const res = await POST(makeEvent({ username: "alice" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 409 when username is already set (needsUsername = false)", async () => {
    mockSession = { ...VALID_SESSION, needsUsername: false, username: "alice" };
    const res = await POST(makeEvent({ username: "bob" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already set/i);
  });

  it("returns 400 when the GitHub account has no email", async () => {
    mockSession = { ...VALID_SESSION, email: "" };
    const res = await POST(makeEvent({ username: "alice" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when body is not valid JSON", async () => {
    mockSession = VALID_SESSION;
    const event = {
      params: {},
      request: new Request("http://localhost/api/auth/setup-username", {
        method: "POST",
        body: "not-json",
      }),
      nativeEvent: { context: {} },
    } as APIEvent;
    const res = await POST(event);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it("returns 400 when username is too short", async () => {
    mockSession = VALID_SESSION;
    const res = await POST(makeEvent({ username: "ab" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when username contains invalid characters", async () => {
    mockSession = VALID_SESSION;
    const res = await POST(makeEvent({ username: "hello world!" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when username is too long (>30 chars)", async () => {
    mockSession = VALID_SESSION;
    const res = await POST(makeEvent({ username: "a".repeat(31) }));
    expect(res.status).toBe(400);
  });

  it("inserts the user and returns 200 for a valid username", async () => {
    mockSession = VALID_SESSION;
    const res = await POST(makeEvent({ username: "alice_one" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    const row = sqlite
      .prepare("SELECT username, email, github_id FROM users WHERE username = ?")
      .get("alice_one") as { username: string; email: string; github_id: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.username).toBe("alice_one");
    expect(row!.email).toBe("user@example.com");
    expect(row!.github_id).toBe("gh-123");
  });

  it("returns 409 when the username is already taken (conflict on insert)", async () => {
    // Pre-insert a user with the same username as a different GitHub account.
    sqlite
      .prepare(
        "INSERT INTO users (github_id, username, email) VALUES (?, ?, ?)"
      )
      .run("gh-999", "taken_name", "other@example.com");

    mockSession = VALID_SESSION;
    const res = await POST(makeEvent({ username: "taken_name" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already taken/i);
  });

  it("accepts usernames with hyphens and underscores", async () => {
    mockSession = VALID_SESSION;
    const res = await POST(makeEvent({ username: "my-user_name" }));
    expect(res.status).toBe(200);
  });

  it("accepts a 30-character username (boundary)", async () => {
    mockSession = VALID_SESSION;
    const res = await POST(makeEvent({ username: "a".repeat(30) }));
    expect(res.status).toBe(200);
  });

  it("accepts a 3-character username (boundary)", async () => {
    mockSession = VALID_SESSION;
    const res = await POST(makeEvent({ username: "abc" }));
    expect(res.status).toBe(200);
  });
});
