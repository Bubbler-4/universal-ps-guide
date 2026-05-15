import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, seedProblems, type TestDb } from "./helpers";
import type { APIEvent } from "@solidjs/start/server";

// Mock the server/db module so GET() uses the in-memory Drizzle instance.
let mockDb: TestDb;
vi.mock("~/server/db", () => ({
  getD1: () => mockDb,
}));

// Import AFTER vi.mock so the mock is applied.
const { GET } = await import("~/routes/api/problems/search");

function makeSearchEvent(params: { site?: string; prefix?: string }): {
  params: Record<string, string>;
  request: Request;
  nativeEvent: { context: Record<string, unknown> };
} {
  const url = new URL("http://localhost/api/problems/search");
  if (params.site !== undefined) url.searchParams.set("site", params.site);
  if (params.prefix !== undefined) url.searchParams.set("prefix", params.prefix);
  return {
    params: {},
    request: new Request(url.toString()),
    nativeEvent: { context: {} },
  };
}

describe("GET /api/problems/search", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
  });

  afterEach(() => {
    sqlite.close();
  });

  it("returns 400 when site param is missing", async () => {
    const event = makeSearchEvent({ prefix: "ABC" });
    const res = await GET(event as unknown as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns empty matches when prefix is empty", async () => {
    const event = makeSearchEvent({ site: "codeforces", prefix: "" });
    const res = await GET(event as unknown as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toEqual([]);
    expect(body.hasExactMatch).toBe(false);
  });

  it("returns empty matches when no problems match the prefix", async () => {
    seedProblems(sqlite, [
      { site: "codeforces", externalProblemId: "1700A", externalProblemLink: "https://codeforces.com/problemset/problem/1700/A" },
    ]);
    const event = makeSearchEvent({ site: "codeforces", prefix: "XYZ" });
    const res = await GET(event as unknown as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toEqual([]);
    expect(body.hasExactMatch).toBe(false);
  });

  it("returns prefix matches sorted alphabetically", async () => {
    seedProblems(sqlite, [
      { site: "codeforces", externalProblemId: "1700C", externalProblemLink: "https://codeforces.com/problemset/problem/1700/C" },
      { site: "codeforces", externalProblemId: "1700A", externalProblemLink: "https://codeforces.com/problemset/problem/1700/A" },
      { site: "codeforces", externalProblemId: "1700B", externalProblemLink: "https://codeforces.com/problemset/problem/1700/B" },
    ]);
    const event = makeSearchEvent({ site: "codeforces", prefix: "1700" });
    const res = await GET(event as unknown as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toEqual(["1700A", "1700B", "1700C"]);
    expect(body.hasExactMatch).toBe(false);
  });

  it("places exact match first when it exists", async () => {
    seedProblems(sqlite, [
      { site: "codeforces", externalProblemId: "1700C", externalProblemLink: "https://codeforces.com/problemset/problem/1700/C" },
      { site: "codeforces", externalProblemId: "1700", externalProblemLink: "https://codeforces.com/problemset/problem/1700" },
      { site: "codeforces", externalProblemId: "1700A", externalProblemLink: "https://codeforces.com/problemset/problem/1700/A" },
    ]);
    const event = makeSearchEvent({ site: "codeforces", prefix: "1700" });
    const res = await GET(event as unknown as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches[0]).toBe("1700");
    expect(body.hasExactMatch).toBe(true);
    expect(body.matches).toContain("1700A");
    expect(body.matches).toContain("1700C");
  });

  it("normalizes the prefix (case-insensitive)", async () => {
    seedProblems(sqlite, [
      { site: "codeforces", externalProblemId: "1700A", externalProblemLink: "https://codeforces.com/problemset/problem/1700/A" },
    ]);
    const event = makeSearchEvent({ site: "codeforces", prefix: "1700a" });
    const res = await GET(event as unknown as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasExactMatch).toBe(true);
    expect(body.matches).toContain("1700A");
  });

  it("limits results to at most 10", async () => {
    seedProblems(sqlite,
      Array.from({ length: 15 }, (_, i) => ({
        site: "codeforces",
        externalProblemId: `ABC${String(i).padStart(3, "0")}`,
        externalProblemLink: `https://codeforces.com/problem/abc${i}`,
      }))
    );
    const event = makeSearchEvent({ site: "codeforces", prefix: "ABC" });
    const res = await GET(event as unknown as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches.length).toBe(10);
  });

  it("only returns problems from the specified site", async () => {
    seedProblems(sqlite, [
      { site: "codeforces", externalProblemId: "1700A", externalProblemLink: "https://codeforces.com/problemset/problem/1700/A" },
      { site: "qoj", externalProblemId: "1700B", externalProblemLink: "https://qoj.ac/problem/1700B" },
    ]);
    const event = makeSearchEvent({ site: "codeforces", prefix: "1700" });
    const res = await GET(event as unknown as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toEqual(["1700A"]);
  });

  it("excludes soft-deleted problems", async () => {
    sqlite.exec(`
      INSERT INTO problems (site, external_problem_id, external_problem_link, deleted_at)
      VALUES ('codeforces', '1700A', 'https://codeforces.com/problemset/problem/1700/A', '2024-01-01 00:00:00')
    `);
    const event = makeSearchEvent({ site: "codeforces", prefix: "1700" });
    const res = await GET(event as unknown as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toEqual([]);
  });

  it("excludes non-active problems", async () => {
    seedProblems(sqlite, [
      { site: "codeforces", externalProblemId: "1700A", externalProblemLink: "https://codeforces.com/problemset/problem/1700/A", status: "hidden" },
    ]);
    const event = makeSearchEvent({ site: "codeforces", prefix: "1700" });
    const res = await GET(event as unknown as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toEqual([]);
  });

  it("returns empty matches when prefix is missing from query string", async () => {
    const event = makeSearchEvent({ site: "codeforces" });
    const res = await GET(event as unknown as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toEqual([]);
    expect(body.hasExactMatch).toBe(false);
  });
});
