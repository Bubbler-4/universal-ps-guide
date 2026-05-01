import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, makeRequestEvent, seedTranslations, type TestDb, type TestApiEvent } from "./helpers";
import type { APIEvent } from "@solidjs/start/server";
import type { AppSession } from "~/lib/auth";

// Mock the server/db module so handlers use the in-memory Drizzle instance.
let mockDb: TestDb;
vi.mock("~/server/db", () => ({
  getD1: () => mockDb,
}));

// Mock auth so POST tests can control the session without real OAuth.
let mockSession: AppSession | null = null;
vi.mock("~/lib/auth", () => ({
  getServerSession: () => Promise.resolve(mockSession),
}));

// Mock env so getCloudflareEnv doesn't throw in test context.
vi.mock("~/server/env", () => ({
  getCloudflareEnv: () => ({}),
}));

// Import AFTER vi.mock so the mock is applied.
const { GET, POST } = await import("~/routes/api/translations/index");

/** A fully-valid session used by POST tests that need authentication. */
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

describe("GET /api/translations", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
  });

  afterEach(() => {
    sqlite.close();
  });

  it("returns 400 when site query param is missing", async () => {
    const event = makeRequestEvent(
      "http://localhost/api/translations?externalProblemId=1700A"
    );
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemId query param is missing", async () => {
    const event = makeRequestEvent(
      "http://localhost/api/translations?site=codeforces"
    );
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when both query params are missing", async () => {
    const event = makeRequestEvent("http://localhost/api/translations");
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(400);
  });

  it("returns empty translations when problem does not exist", async () => {
    const event = makeRequestEvent(
      "http://localhost/api/translations?site=codeforces&externalProblemId=9999Z"
    );
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.translations).toEqual([]);
  });

  it("returns active translations for an existing problem", async () => {
    sqlite.exec(`INSERT INTO users (username, email) VALUES ('alice', 'alice@example.com')`);
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id) VALUES ('atcoder', 'abc300_c')`
    );
    const problemId = (sqlite.prepare("SELECT id FROM problems LIMIT 1").get() as { id: number }).id;
    const userId = (sqlite.prepare("SELECT id FROM users LIMIT 1").get() as { id: number }).id;
    seedTranslations(sqlite, [{ problemId, userId, content: "Hello" }]);

    const event = makeRequestEvent(
      "http://localhost/api/translations?site=atcoder&externalProblemId=abc300_c"
    );
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.translations).toHaveLength(1);
    expect(body.translations[0].content).toBe("Hello");
  });

  it("excludes non-active translations", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com')`);
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id) VALUES ('atcoder', 'abc300_c')`
    );
    const problemId = (sqlite.prepare("SELECT id FROM problems LIMIT 1").get() as { id: number }).id;
    seedTranslations(sqlite, [
      { problemId, userId: 1, content: "Active", status: "active" },
      { problemId, userId: 2, content: "Hidden", status: "hidden" },
    ]);

    const event = makeRequestEvent(
      "http://localhost/api/translations?site=atcoder&externalProblemId=abc300_c"
    );
    const res = await GET(event as APIEvent);
    const body = await res.json();
    expect(body.translations).toHaveLength(1);
    expect(body.translations[0].content).toBe("Active");
  });

  it("excludes soft-deleted translations", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com')`);
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id) VALUES ('atcoder', 'abc300_c')`
    );
    const problemId = (sqlite.prepare("SELECT id FROM problems LIMIT 1").get() as { id: number }).id;
    seedTranslations(sqlite, [
      { problemId, userId: 1, content: "Live", deletedAt: null },
      { problemId, userId: 2, content: "Deleted", deletedAt: "2025-01-01 00:00:00" },
    ]);

    const event = makeRequestEvent(
      "http://localhost/api/translations?site=atcoder&externalProblemId=abc300_c"
    );
    const res = await GET(event as APIEvent);
    const body = await res.json();
    expect(body.translations).toHaveLength(1);
    expect(body.translations[0].content).toBe("Live");
  });

  it("returns translations ordered by createdAt ascending", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com')`);
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id) VALUES ('atcoder', 'abc300_c')`
    );
    const problemId = (sqlite.prepare("SELECT id FROM problems LIMIT 1").get() as { id: number }).id;
    seedTranslations(sqlite, [
      { problemId, userId: 1, content: "First", createdAt: "2024-03-01 00:00:00" },
      { problemId, userId: 2, content: "Second", createdAt: "2024-06-01 00:00:00" },
    ]);

    const event = makeRequestEvent(
      "http://localhost/api/translations?site=atcoder&externalProblemId=abc300_c"
    );
    const res = await GET(event as APIEvent);
    const body = await res.json();
    expect(body.translations[0].content).toBe("First");
    expect(body.translations[1].content).toBe("Second");
  });
});

describe("POST /api/translations", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
    // Default: authenticated with userId=1 (overridden per-test as needed).
    mockSession = makeSession(1);
  });

  afterEach(() => {
    sqlite.close();
    mockSession = null;
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const event = makeRequestEvent("http://localhost/api/translations", {
      site: "codeforces",
      externalProblemId: "1700A",
      content: "Hello",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when request has no body (json() throws)", async () => {
    const event = makeRequestEvent("http://localhost/api/translations");
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when body is not an object", async () => {
    const event = makeRequestEvent("http://localhost/api/translations", "string");
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when required fields are missing", async () => {
    const event = makeRequestEvent("http://localhost/api/translations", {
      site: "codeforces",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when site is not a string", async () => {
    const event = makeRequestEvent("http://localhost/api/translations", {
      site: 42,
      externalProblemId: "1700A",
      content: "Hello",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when site is an empty string", async () => {
    const event = makeRequestEvent("http://localhost/api/translations", {
      site: "   ",
      externalProblemId: "1700A",
      content: "Hello",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when content is an empty string", async () => {
    const event = makeRequestEvent("http://localhost/api/translations", {
      site: "codeforces",
      externalProblemId: "1700A",
      content: "   ",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("creates a new problem and translation, returning 201", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (99, 'bob', 'bob@example.com')`);
    mockSession = makeSession(99);

    const event = makeRequestEvent("http://localhost/api/translations", {
      site: "codeforces",
      externalProblemId: "1700A",
      content: "Problem statement here",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.translation).toMatchObject({
      content: "Problem statement here",
      authorId: 99,
      status: "active",
    });

    // Verify the problem was upserted
    const problem = sqlite
      .prepare("SELECT * FROM problems WHERE site = 'codeforces' AND external_problem_id = '1700A'")
      .get();
    expect(problem).toBeTruthy();
  });

  it("uses existing problem when it already exists", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (5, 'carol', 'carol@example.com')`);
    sqlite.exec(
      `INSERT INTO problems (id, site, external_problem_id) VALUES (77, 'qoj', '1234')`
    );
    mockSession = makeSession(5);

    const event = makeRequestEvent("http://localhost/api/translations", {
      site: "qoj",
      externalProblemId: "1234",
      content: "My translation",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.translation.problemId).toBe(77);

    // Only one problem row should exist
    const count = (
      sqlite
        .prepare("SELECT COUNT(*) as c FROM problems WHERE site = 'qoj' AND external_problem_id = '1234'")
        .get() as { c: number }
    ).c;
    expect(count).toBe(1);
  });

  it("trims whitespace from site, externalProblemId, and content", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (3, 'dave', 'dave@example.com')`);
    mockSession = makeSession(3);

    const event = makeRequestEvent("http://localhost/api/translations", {
      site: "  codeforces  ",
      externalProblemId: "  1700A  ",
      content: "  trimmed content  ",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.translation.content).toBe("trimmed content");

    const problem = sqlite
      .prepare(
        "SELECT * FROM problems WHERE site = 'codeforces' AND external_problem_id = '1700A'"
      )
      .get();
    expect(problem).toBeTruthy();
  });

  it("returns 409 and preserves first content when same author POSTs again for same problem", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (7, 'eve', 'eve@example.com')`);
    mockSession = makeSession(7);

    const firstEvent = makeRequestEvent("http://localhost/api/translations", {
      site: "codeforces",
      externalProblemId: "800A",
      content: "Original translation",
    });
    const firstRes = await POST(firstEvent as unknown as APIEvent);
    expect(firstRes.status).toBe(201);

    const secondEvent = makeRequestEvent("http://localhost/api/translations", {
      site: "codeforces",
      externalProblemId: "800A",
      content: "Replacement translation",
    });
    const secondRes = await POST(secondEvent as unknown as APIEvent);
    expect(secondRes.status).toBe(409);

    // Content in DB must still be the first one
    const rows = sqlite
      .prepare("SELECT content FROM translations WHERE author_id = 7")
      .all() as Array<{ content: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("Original translation");
  });
});
