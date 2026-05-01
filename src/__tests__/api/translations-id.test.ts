import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, seedTranslations, type TestDb } from "./helpers";
import type { APIEvent } from "@solidjs/start/server";
import type { AppSession } from "~/lib/auth";

// Mock the server/db module so handlers use the in-memory Drizzle instance.
let mockDb: TestDb;
vi.mock("~/server/db", () => ({
  getD1: () => mockDb,
}));

// Mock auth so tests can control the session without real OAuth.
let mockSession: AppSession | null = null;
vi.mock("~/lib/auth", () => ({
  getServerSession: () => Promise.resolve(mockSession),
}));

// Mock env so getCloudflareEnv doesn't throw in test context.
vi.mock("~/server/env", () => ({
  getCloudflareEnv: () => ({}),
}));

// Import AFTER vi.mock so the mocks are applied.
const { PUT, DELETE } = await import("~/routes/api/translations/[id]");

/** Build a minimal APIEvent-like object for a request with route params. */
function makeIdEvent(
  method: string,
  id: string,
  body?: unknown
): Omit<APIEvent, "locals"> {
  return {
    params: { id },
    request:
      body !== undefined
        ? new Request(`http://localhost/api/translations/${id}`, {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        : new Request(`http://localhost/api/translations/${id}`, { method }),
    nativeEvent: { context: {} } as unknown as APIEvent["nativeEvent"],
  };
}

/** A fully-valid session used by tests that need authentication. */
function makeSession(dbUserId: number): AppSession {
  return {
    githubId: "gh123",
    email: "test@example.com",
    name: "Test User",
    image: "",
    username: "testuser",
    dbUserId,
    needsUsername: false,
  };
}

describe("PUT /api/translations/:id", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
    mockSession = makeSession(1);
  });

  afterEach(() => {
    sqlite.close();
    mockSession = null;
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const res = await PUT(makeIdEvent("PUT", "1", { content: "new" }) as APIEvent);
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-integer id", async () => {
    const res = await PUT(makeIdEvent("PUT", "abc", { content: "new" }) as APIEvent);
    expect(res.status).toBe(400);
  });

  it("returns 400 for id=0", async () => {
    const res = await PUT(makeIdEvent("PUT", "0", { content: "new" }) as APIEvent);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    const res = await PUT(makeIdEvent("PUT", "1") as APIEvent);
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is empty", async () => {
    const res = await PUT(
      makeIdEvent("PUT", "1", { content: "   " }) as APIEvent
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when translation does not exist", async () => {
    const res = await PUT(
      makeIdEvent("PUT", "999", { content: "updated" }) as APIEvent
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when translation belongs to a different user", async () => {
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com')`
    );
    sqlite.exec(
      `INSERT INTO problems (id, site, external_problem_id) VALUES (10, 'codeforces', '1700A')`
    );
    seedTranslations(sqlite, [{ problemId: 10, userId: 2, content: "Bob's translation" }]);
    const translationId = (
      sqlite.prepare("SELECT id FROM translations LIMIT 1").get() as { id: number }
    ).id;

    mockSession = makeSession(1); // alice, not bob
    const res = await PUT(
      makeIdEvent("PUT", String(translationId), { content: "hacked" }) as APIEvent
    );
    expect(res.status).toBe(403);
  });

  it("updates content and returns the updated translation", async () => {
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (5, 'carol', 'carol@example.com')`
    );
    sqlite.exec(
      `INSERT INTO problems (id, site, external_problem_id) VALUES (20, 'atcoder', 'abc300_c')`
    );
    seedTranslations(sqlite, [{ problemId: 20, userId: 5, content: "Original" }]);
    const translationId = (
      sqlite.prepare("SELECT id FROM translations LIMIT 1").get() as { id: number }
    ).id;

    mockSession = makeSession(5);
    const res = await PUT(
      makeIdEvent("PUT", String(translationId), { content: "  Updated  " }) as APIEvent
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.translation.content).toBe("Updated");

    const row = sqlite
      .prepare("SELECT content FROM translations WHERE id = ?")
      .get(translationId) as { content: string };
    expect(row.content).toBe("Updated");
  });

  it("returns 404 for a soft-deleted translation", async () => {
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (6, 'dave', 'dave@example.com')`
    );
    sqlite.exec(
      `INSERT INTO problems (id, site, external_problem_id) VALUES (30, 'codeforces', '800A')`
    );
    seedTranslations(sqlite, [
      { problemId: 30, userId: 6, content: "Gone", deletedAt: "2025-01-01 00:00:00" },
    ]);
    const translationId = (
      sqlite.prepare("SELECT id FROM translations LIMIT 1").get() as { id: number }
    ).id;

    mockSession = makeSession(6);
    const res = await PUT(
      makeIdEvent("PUT", String(translationId), { content: "new" }) as APIEvent
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/translations/:id", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
    mockSession = makeSession(1);
  });

  afterEach(() => {
    sqlite.close();
    mockSession = null;
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const res = await DELETE(makeIdEvent("DELETE", "1") as APIEvent);
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-integer id", async () => {
    const res = await DELETE(makeIdEvent("DELETE", "abc") as APIEvent);
    expect(res.status).toBe(400);
  });

  it("returns 404 when translation does not exist", async () => {
    const res = await DELETE(makeIdEvent("DELETE", "999") as APIEvent);
    expect(res.status).toBe(404);
  });

  it("returns 403 when translation belongs to a different user", async () => {
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com')`
    );
    sqlite.exec(
      `INSERT INTO problems (id, site, external_problem_id) VALUES (10, 'codeforces', '1700A')`
    );
    seedTranslations(sqlite, [{ problemId: 10, userId: 2, content: "Bob's translation" }]);
    const translationId = (
      sqlite.prepare("SELECT id FROM translations LIMIT 1").get() as { id: number }
    ).id;

    mockSession = makeSession(1); // alice, not bob
    const res = await DELETE(makeIdEvent("DELETE", String(translationId)) as APIEvent);
    expect(res.status).toBe(403);
  });

  it("soft-deletes the translation and returns success", async () => {
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (7, 'eve', 'eve@example.com')`
    );
    sqlite.exec(
      `INSERT INTO problems (id, site, external_problem_id) VALUES (40, 'qoj', '1234')`
    );
    seedTranslations(sqlite, [{ problemId: 40, userId: 7, content: "To be deleted" }]);
    const translationId = (
      sqlite.prepare("SELECT id FROM translations LIMIT 1").get() as { id: number }
    ).id;

    mockSession = makeSession(7);
    const res = await DELETE(makeIdEvent("DELETE", String(translationId)) as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify it is soft-deleted (deleted_at is set, row still exists).
    const row = sqlite
      .prepare("SELECT deleted_at FROM translations WHERE id = ?")
      .get(translationId) as { deleted_at: string | null };
    expect(row.deleted_at).not.toBeNull();
  });

  it("returns 404 for an already soft-deleted translation", async () => {
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (8, 'frank', 'frank@example.com')`
    );
    sqlite.exec(
      `INSERT INTO problems (id, site, external_problem_id) VALUES (50, 'codeforces', '900A')`
    );
    seedTranslations(sqlite, [
      { problemId: 50, userId: 8, content: "Already gone", deletedAt: "2025-01-01 00:00:00" },
    ]);
    const translationId = (
      sqlite.prepare("SELECT id FROM translations LIMIT 1").get() as { id: number }
    ).id;

    mockSession = makeSession(8);
    const res = await DELETE(makeIdEvent("DELETE", String(translationId)) as APIEvent);
    expect(res.status).toBe(404);
  });
});
