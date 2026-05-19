import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  createTestDb,
  makeRequestEvent,
  makeSession,
  seedCollections,
  seedCollectionProblems,
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

const { GET, POST } = await import("~/routes/api/collections/index");

describe("GET /api/collections", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
  });

  afterEach(() => {
    sqlite.close();
  });

  it("returns empty list when there are no collections", async () => {
    const res = await GET(makeRequestEvent("http://localhost/api/collections") as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collections).toEqual([]);
  });

  it("returns non-deleted collections with problem counts", async () => {
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
    seedCollections(sqlite, [
      { id: 100, authorId: 1, title: "A" },
      { id: 101, authorId: 1, title: "Deleted", deletedAt: "2024-01-01 00:00:00" },
    ]);
    seedCollectionProblems(sqlite, [
      { collectionId: 100, problemId: 10, position: 0 },
      { collectionId: 100, problemId: 11, position: 1 },
    ]);

    const res = await GET(makeRequestEvent("http://localhost/api/collections") as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collections).toHaveLength(1);
    expect(body.collections[0]).toMatchObject({
      id: 100,
      title: "A",
      authorId: 1,
      authorUsername: "alice",
      problemCount: 2,
    });
  });
});

describe("POST /api/collections", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
    mockSession = makeSession(1);
    sqlite.exec(`INSERT INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com')`);
  });

  afterEach(() => {
    sqlite.close();
    mockSession = null;
  });

  it("returns 401 when not authenticated", async () => {
    mockSession = null;
    const res = await POST(
      makeRequestEvent("http://localhost/api/collections", {
        title: "My Collection",
        problemIds: [],
      }) as APIEvent
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing title", async () => {
    const res = await POST(
      makeRequestEvent("http://localhost/api/collections", { problemIds: [] }) as APIEvent
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when problemIds has duplicates", async () => {
    const res = await POST(
      makeRequestEvent("http://localhost/api/collections", {
        title: "Duplicate IDs",
        problemIds: [1, 1],
      }) as APIEvent
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when problemIds exceeds 100 items", async () => {
    const res = await POST(
      makeRequestEvent("http://localhost/api/collections", {
        title: "Too many",
        problemIds: Array.from({ length: 101 }, (_, i) => i + 1),
      }) as APIEvent
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when some problems do not exist", async () => {
    seedProblems(sqlite, [
      {
        id: 10,
        site: "codeforces",
        externalProblemId: "1700A",
        externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
      },
    ]);

    const res = await POST(
      makeRequestEvent("http://localhost/api/collections", {
        title: "Missing problem",
        problemIds: [10, 11],
      }) as APIEvent
    );
    expect(res.status).toBe(400);
  });

  it("creates a collection and stores ordered problem mappings with short descriptions", async () => {
    seedProblems(sqlite, [
      {
        id: 20,
        site: "codeforces",
        externalProblemId: "1500A",
        externalProblemLink: "https://codeforces.com/problemset/problem/1500/A",
      },
      {
        id: 21,
        site: "atcoder",
        externalProblemId: "abc300_d",
        externalProblemLink: "https://atcoder.jp/contests/abc300/tasks/abc300_d",
      },
    ]);

    const res = await POST(
      makeRequestEvent("http://localhost/api/collections", {
        title: "  My Set  ",
        problems: [
          { id: 21, shortDescription: "First note" },
          { id: 20, shortDescription: "  " },
        ],
      }) as APIEvent
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.collection.title).toBe("My Set");
    expect(body.collection.authorId).toBe(1);

    const collectionId = body.collection.id as number;
    const links = sqlite
      .prepare(
        "SELECT problem_id, position, short_description FROM collection_problems WHERE collection_id = ? ORDER BY position"
      )
      .all(collectionId) as Array<{ problem_id: number; position: number; short_description: string | null }>;

    expect(links).toEqual([
      { problem_id: 21, position: 0, short_description: "First note" },
      { problem_id: 20, position: 1, short_description: null },
    ]);
  });

  it("creates a collection with many problems (chunked INSERT)", async () => {
    // Seed 26 problems — with 4 columns each, a single INSERT would need
    // 26 * 4 = 104 bound parameters, exceeding D1's 100-parameter limit.
    const problemCount = 26;
    seedProblems(
      sqlite,
      Array.from({ length: problemCount }, (_, i) => ({
        id: i + 1,
        site: "codeforces",
        externalProblemId: `P${i + 1}`,
        externalProblemLink: `https://codeforces.com/problemset/problem/${i + 1}/A`,
      }))
    );

    const res = await POST(
      makeRequestEvent("http://localhost/api/collections", {
        title: "Big Set",
        problems: Array.from({ length: problemCount }, (_, i) => ({ id: i + 1 })),
      }) as APIEvent
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    const collectionId = body.collection.id as number;
    const links = sqlite
      .prepare(
        "SELECT problem_id, position FROM collection_problems WHERE collection_id = ? ORDER BY position"
      )
      .all(collectionId) as Array<{ problem_id: number; position: number }>;

    expect(links).toHaveLength(problemCount);
    for (let i = 0; i < problemCount; i++) {
      expect(links[i]).toEqual({ problem_id: i + 1, position: i });
    }
  });
});
