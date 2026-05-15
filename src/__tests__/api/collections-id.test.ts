import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  createTestDb,
  makeSession,
  seedCollectionProblems,
  seedCollections,
  seedProblems,
  type TestDb,
} from "./helpers";
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

const { GET, PUT, DELETE } = await import("~/routes/api/collections/[id]");

function makeIdEvent(method: string, id: string, body?: unknown): Omit<APIEvent, "locals"> {
  return {
    params: { id },
    request:
      body !== undefined
        ? new Request(`http://localhost/api/collections/${id}`, {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        : new Request(`http://localhost/api/collections/${id}`, { method }),
    nativeEvent: { context: {} } as unknown as APIEvent["nativeEvent"],
  };
}

describe("GET /api/collections/:id", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
  });

  afterEach(() => {
    sqlite.close();
  });

  it("returns 400 for invalid id", async () => {
    const res = await GET(makeIdEvent("GET", "abc") as APIEvent);
    expect(res.status).toBe(400);
  });

  it("returns 404 when collection does not exist", async () => {
    const res = await GET(makeIdEvent("GET", "999") as APIEvent);
    expect(res.status).toBe(404);
  });

  it("returns collection with ordered problems", async () => {
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com')`
    );
    seedProblems(sqlite, [
      {
        id: 10,
        site: "codeforces",
        externalProblemId: "1700A",
        externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
      },
      {
        id: 11,
        site: "atcoder",
        externalProblemId: "abc300_c",
        externalProblemLink: "https://atcoder.jp/contests/abc300/tasks/abc300_c",
      },
    ]);
    seedCollections(sqlite, [{ id: 100, authorId: 1, title: "My Collection" }]);
    seedCollectionProblems(sqlite, [
      { collectionId: 100, problemId: 11, position: 0, shortDescription: "First in order" },
      { collectionId: 100, problemId: 10, position: 1 },
    ]);

    const res = await GET(makeIdEvent("GET", "100") as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collection).toMatchObject({
      id: 100,
      title: "My Collection",
      authorUsername: "alice",
    });
    expect(body.problems).toHaveLength(2);
    expect(body.problems[0].id).toBe(11);
    expect(body.problems[0].shortDescription).toBe("First in order");
    expect(body.problems[1].id).toBe(10);
    expect(body.problems[1].shortDescription).toBeNull();
  });
});

describe("PUT /api/collections/:id", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
    mockSession = makeSession(1);
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com')`
    );
  });

  afterEach(() => {
    sqlite.close();
    mockSession = null;
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const res = await PUT(
      makeIdEvent("PUT", "1", { title: "New", problemIds: [] }) as APIEvent
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when collection belongs to another user", async () => {
    seedCollections(sqlite, [{ id: 100, authorId: 2, title: "Bob's set" }]);
    const res = await PUT(
      makeIdEvent("PUT", "100", { title: "Hack", problemIds: [] }) as APIEvent
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when problemIds has duplicates", async () => {
    seedCollections(sqlite, [{ id: 100, authorId: 1, title: "Mine" }]);
    const res = await PUT(
      makeIdEvent("PUT", "100", { title: "Mine", problemIds: [1, 1] }) as APIEvent
    );
    expect(res.status).toBe(400);
  });

  it("updates title and replaces problem mappings with short descriptions", async () => {
    seedProblems(sqlite, [
      {
        id: 10,
        site: "codeforces",
        externalProblemId: "1700A",
        externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
      },
      {
        id: 11,
        site: "atcoder",
        externalProblemId: "abc300_c",
        externalProblemLink: "https://atcoder.jp/contests/abc300/tasks/abc300_c",
      },
      {
        id: 12,
        site: "qoj",
        externalProblemId: "1234",
        externalProblemLink: "https://qoj.ac/problem/1234",
      },
    ]);
    seedCollections(sqlite, [{ id: 100, authorId: 1, title: "Before" }]);
    seedCollectionProblems(sqlite, [{ collectionId: 100, problemId: 10, position: 0 }]);

    const res = await PUT(
      makeIdEvent("PUT", "100", {
        title: "  After  ",
        problems: [
          { id: 12, shortDescription: "QOJ pick" },
          { id: 11, shortDescription: "" },
        ],
      }) as APIEvent
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collection.title).toBe("After");

    const rows = sqlite
      .prepare(
        "SELECT problem_id, position, short_description FROM collection_problems WHERE collection_id = 100 ORDER BY position"
      )
      .all() as Array<{ problem_id: number; position: number; short_description: string | null }>;
    expect(rows).toEqual([
      { problem_id: 12, position: 0, short_description: "QOJ pick" },
      { problem_id: 11, position: 1, short_description: null },
    ]);
  });
});

describe("DELETE /api/collections/:id", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
    mockSession = makeSession(1);
    sqlite.exec(
      `INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com')`
    );
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

  it("returns 403 when collection belongs to another user", async () => {
    seedCollections(sqlite, [{ id: 100, authorId: 2, title: "Bob's set" }]);
    const res = await DELETE(makeIdEvent("DELETE", "100") as APIEvent);
    expect(res.status).toBe(403);
  });

  it("soft-deletes own collection", async () => {
    seedCollections(sqlite, [{ id: 100, authorId: 1, title: "Mine" }]);
    const res = await DELETE(makeIdEvent("DELETE", "100") as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const row = sqlite
      .prepare("SELECT deleted_at FROM collections WHERE id = 100")
      .get() as { deleted_at: string | null };
    expect(row.deleted_at).not.toBeNull();
  });
});
