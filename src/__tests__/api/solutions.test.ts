import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, makeRequestEvent, seedProblems, seedSolutions, type TestDb, type TestApiEvent } from "./helpers";
import type { APIEvent } from "@solidjs/start/server";
import type { AppSession } from "~/lib/auth";

let mockDb: TestDb;
vi.mock("~/server/db", () => ({
  getD1: () => mockDb,
}));

let mockSession: AppSession | null = null;
vi.mock("~/lib/auth", () => ({
  getServerSession: () => Promise.resolve(mockSession),
}));

vi.mock("~/server/env", () => ({
  getCloudflareEnv: () => ({}),
}));

const { GET, POST } = await import("~/routes/api/solutions/index");

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

describe("GET /api/solutions", () => {
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
      "http://localhost/api/solutions?externalProblemId=1700A"
    );
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(400);
  });

  it("returns 400 when externalProblemId query param is missing", async () => {
    const event = makeRequestEvent("http://localhost/api/solutions?site=codeforces");
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(400);
  });

  it("returns empty solutions when problem does not exist", async () => {
    const event = makeRequestEvent(
      "http://localhost/api/solutions?site=codeforces&externalProblemId=9999Z"
    );
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.solutions).toEqual([]);
  });

  it("returns active solutions for an existing problem", async () => {
    sqlite.exec(`INSERT INTO users (username, email) VALUES ('alice', 'alice@example.com')`);
    seedProblems(sqlite, [
      { site: "atcoder", externalProblemId: "abc300_c", externalProblemLink: "https://atcoder.jp/contests/abc300/tasks/abc300_c" },
    ]);
    const problemId = (sqlite.prepare("SELECT id FROM problems LIMIT 1").get() as { id: number }).id;
    const userId = (sqlite.prepare("SELECT id FROM users LIMIT 1").get() as { id: number }).id;
    seedSolutions(sqlite, [{ problemId, userId, content: "Hello" }]);

    const event = makeRequestEvent(
      "http://localhost/api/solutions?site=atcoder&externalProblemId=abc300_c"
    );
    const res = await GET(event as APIEvent);
    const body = await res.json();
    expect(body.solutions).toHaveLength(1);
    expect(body.solutions[0].content).toBe("Hello");
  });

  it("excludes non-active solutions", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com')`);
    seedProblems(sqlite, [
      { site: "atcoder", externalProblemId: "abc300_c", externalProblemLink: "https://atcoder.jp/contests/abc300/tasks/abc300_c" },
    ]);
    const problemId = (sqlite.prepare("SELECT id FROM problems LIMIT 1").get() as { id: number }).id;
    seedSolutions(sqlite, [
      { problemId, userId: 1, content: "Active", status: "active" },
      { problemId, userId: 2, content: "Hidden", status: "hidden" },
    ]);

    const event = makeRequestEvent(
      "http://localhost/api/solutions?site=atcoder&externalProblemId=abc300_c"
    );
    const res = await GET(event as APIEvent);
    const body = await res.json();
    expect(body.solutions).toHaveLength(1);
    expect(body.solutions[0].content).toBe("Active");
  });

  it("excludes soft-deleted solutions", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com')`);
    seedProblems(sqlite, [
      { site: "atcoder", externalProblemId: "abc300_c", externalProblemLink: "https://atcoder.jp/contests/abc300/tasks/abc300_c" },
    ]);
    const problemId = (sqlite.prepare("SELECT id FROM problems LIMIT 1").get() as { id: number }).id;
    seedSolutions(sqlite, [
      { problemId, userId: 1, content: "Live", deletedAt: null },
      { problemId, userId: 2, content: "Deleted", deletedAt: "2025-01-01 00:00:00" },
    ]);

    const event = makeRequestEvent(
      "http://localhost/api/solutions?site=atcoder&externalProblemId=abc300_c"
    );
    const res = await GET(event as APIEvent);
    const body = await res.json();
    expect(body.solutions).toHaveLength(1);
    expect(body.solutions[0].content).toBe("Live");
  });

  it("returns solutions ordered by createdAt ascending", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com')`);
    seedProblems(sqlite, [
      { site: "atcoder", externalProblemId: "abc300_c", externalProblemLink: "https://atcoder.jp/contests/abc300/tasks/abc300_c" },
    ]);
    const problemId = (sqlite.prepare("SELECT id FROM problems LIMIT 1").get() as { id: number }).id;
    seedSolutions(sqlite, [
      { problemId, userId: 1, content: "First", createdAt: "2024-03-01 00:00:00" },
      { problemId, userId: 2, content: "Second", createdAt: "2024-06-01 00:00:00" },
    ]);

    const event = makeRequestEvent(
      "http://localhost/api/solutions?site=atcoder&externalProblemId=abc300_c"
    );
    const res = await GET(event as APIEvent);
    const body = await res.json();
    expect(body.solutions[0].content).toBe("First");
    expect(body.solutions[1].content).toBe("Second");
  });
});

describe("POST /api/solutions", () => {
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
    const event = makeRequestEvent("http://localhost/api/solutions", {
      site: "codeforces",
      externalProblemId: "1700A",
      content: "Hello",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(401);
  });

  it("returns 400 when request has no body (json() throws)", async () => {
    const event = makeRequestEvent("http://localhost/api/solutions");
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not an object", async () => {
    const event = makeRequestEvent("http://localhost/api/solutions", "string");
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const event = makeRequestEvent("http://localhost/api/solutions", {
      site: "codeforces",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is an empty string", async () => {
    const event = makeRequestEvent("http://localhost/api/solutions", {
      site: "codeforces",
      externalProblemId: "1700A",
      content: "   ",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
  });

  it("creates a solution for an existing problem, returning 201", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (99, 'bob', 'bob@example.com')`);
    seedProblems(sqlite, [
      { site: "codeforces", externalProblemId: "1700A", externalProblemLink: "https://codeforces.com/problemset/problem/1700/A" },
    ]);
    mockSession = makeSession(99);

    const event = makeRequestEvent("http://localhost/api/solutions", {
      site: "codeforces",
      externalProblemId: "1700A",
      content: "Problem solution here",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.solution).toMatchObject({
      content: "Problem solution here",
      authorId: 99,
      status: "active",
    });
  });

  it("returns 404 when problem does not exist", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (99, 'bob', 'bob@example.com')`);
    mockSession = makeSession(99);

    const event = makeRequestEvent("http://localhost/api/solutions", {
      site: "codeforces",
      externalProblemId: "9999Z",
      content: "Problem solution here",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(404);
  });

  it("trims whitespace from site, externalProblemId, and content", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (3, 'dave', 'dave@example.com')`);
    seedProblems(sqlite, [
      { site: "codeforces", externalProblemId: "1700A", externalProblemLink: "https://codeforces.com/problemset/problem/1700/A" },
    ]);
    mockSession = makeSession(3);

    const event = makeRequestEvent("http://localhost/api/solutions", {
      site: "  codeforces  ",
      externalProblemId: "  1700A  ",
      content: "  trimmed content  ",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.solution.content).toBe("trimmed content");
  });

  it("allows the same author to submit multiple solutions for one problem", async () => {
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (7, 'eve', 'eve@example.com')`);
    seedProblems(sqlite, [
      { site: "codeforces", externalProblemId: "800A", externalProblemLink: "https://codeforces.com/problemset/problem/800/A" },
    ]);
    mockSession = makeSession(7);

    const firstEvent = makeRequestEvent("http://localhost/api/solutions", {
      site: "codeforces",
      externalProblemId: "800A",
      content: "First solution",
    });
    const secondEvent = makeRequestEvent("http://localhost/api/solutions", {
      site: "codeforces",
      externalProblemId: "800A",
      content: "Second solution",
    });

    const firstRes = await POST(firstEvent as unknown as APIEvent);
    const secondRes = await POST(secondEvent as unknown as APIEvent);

    expect(firstRes.status).toBe(201);
    expect(secondRes.status).toBe(201);

    const rows = sqlite
      .prepare("SELECT content FROM solutions WHERE author_id = 7 ORDER BY id")
      .all() as Array<{ content: string }>;
    expect(rows).toEqual([
      { content: "First solution" },
      { content: "Second solution" },
    ]);
  });
});
