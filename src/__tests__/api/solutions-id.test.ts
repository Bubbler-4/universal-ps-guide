import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, seedProblems, seedSolutions, type TestDb } from "./helpers";
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

const { PUT, DELETE } = await import("~/routes/api/solutions/[id]");

function makeIdEvent(
  method: string,
  id: string,
  body?: unknown
): Omit<APIEvent, "locals"> {
  return {
    params: { id },
    request:
      body !== undefined
        ? new Request(`http://localhost/api/solutions/${id}`, {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        : new Request(`http://localhost/api/solutions/${id}`, { method }),
    nativeEvent: { context: {} } as unknown as APIEvent["nativeEvent"],
  };
}

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

describe("PUT /api/solutions/:id", () => {
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

  it("returns 400 when content is empty", async () => {
    const res = await PUT(makeIdEvent("PUT", "1", { content: "   " }) as APIEvent);
    expect(res.status).toBe(400);
  });

  it("returns 404 when solution does not exist", async () => {
    const res = await PUT(makeIdEvent("PUT", "999", { content: "updated" }) as APIEvent);
    expect(res.status).toBe(404);
  });

  it("returns 403 when solution belongs to a different user", async () => {
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com')`
    );
    seedProblems(sqlite, [
      { id: 10, site: "codeforces", externalProblemId: "1700A", externalProblemLink: "https://codeforces.com/problemset/problem/1700/A" },
    ]);
    seedSolutions(sqlite, [{ problemId: 10, userId: 2, content: "Bob's solution" }]);
    const solutionId = (
      sqlite.prepare("SELECT id FROM solutions LIMIT 1").get() as { id: number }
    ).id;

    mockSession = makeSession(1);
    const res = await PUT(
      makeIdEvent("PUT", String(solutionId), { content: "hacked" }) as APIEvent
    );
    expect(res.status).toBe(403);
  });

  it("updates content and returns the updated solution", async () => {
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (5, 'carol', 'carol@example.com')`
    );
    seedProblems(sqlite, [
      { id: 20, site: "atcoder", externalProblemId: "abc300_c", externalProblemLink: "https://atcoder.jp/contests/abc300/tasks/abc300_c" },
    ]);
    seedSolutions(sqlite, [{ problemId: 20, userId: 5, content: "Original" }]);
    const solutionId = (
      sqlite.prepare("SELECT id FROM solutions LIMIT 1").get() as { id: number }
    ).id;

    mockSession = makeSession(5);
    const res = await PUT(
      makeIdEvent("PUT", String(solutionId), { content: "  Updated  " }) as APIEvent
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.solution.content).toBe("Updated");
  });
});

describe("DELETE /api/solutions/:id", () => {
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

  it("returns 404 when solution does not exist", async () => {
    const res = await DELETE(makeIdEvent("DELETE", "999") as APIEvent);
    expect(res.status).toBe(404);
  });

  it("returns 403 when solution belongs to a different user", async () => {
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com')`
    );
    seedProblems(sqlite, [
      { id: 10, site: "codeforces", externalProblemId: "1700A", externalProblemLink: "https://codeforces.com/problemset/problem/1700/A" },
    ]);
    seedSolutions(sqlite, [{ problemId: 10, userId: 2, content: "Bob's solution" }]);
    const solutionId = (
      sqlite.prepare("SELECT id FROM solutions LIMIT 1").get() as { id: number }
    ).id;

    mockSession = makeSession(1);
    const res = await DELETE(makeIdEvent("DELETE", String(solutionId)) as APIEvent);
    expect(res.status).toBe(403);
  });

  it("soft-deletes the solution and returns success", async () => {
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (7, 'eve', 'eve@example.com')`
    );
    seedProblems(sqlite, [
      { id: 40, site: "qoj", externalProblemId: "1234", externalProblemLink: "https://qoj.ac/problem/1234" },
    ]);
    seedSolutions(sqlite, [{ problemId: 40, userId: 7, content: "To be deleted" }]);
    const solutionId = (
      sqlite.prepare("SELECT id FROM solutions LIMIT 1").get() as { id: number }
    ).id;

    mockSession = makeSession(7);
    const res = await DELETE(makeIdEvent("DELETE", String(solutionId)) as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const row = sqlite
      .prepare("SELECT deleted_at FROM solutions WHERE id = ?")
      .get(solutionId) as { deleted_at: string | null };
    expect(row.deleted_at).not.toBeNull();
  });
});
