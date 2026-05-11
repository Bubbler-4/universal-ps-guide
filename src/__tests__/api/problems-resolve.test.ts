import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, makeRequestEvent, seedProblems, type TestDb } from "./helpers";
import type { APIEvent } from "@solidjs/start/server";

// Mock the server/db module so POST() uses the in-memory Drizzle instance.
let mockDb: TestDb;
vi.mock("~/server/db", () => ({
  getD1: () => mockDb,
}));

// Import AFTER vi.mock so the mock is applied.
const { POST } = await import("~/routes/api/problems/resolve");

describe("POST /api/problems/resolve", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
  });

  afterEach(() => {
    sqlite.close();
  });

  it("returns 400 when body is not valid JSON", async () => {
    const event = {
      params: {},
      request: new Request("http://localhost/api/problems/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{invalid-json",
      }),
      nativeEvent: { context: {} },
    };
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when body is not an object", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", "string");
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when site is missing", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      externalProblemId: "1700A",
      externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemId is missing", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "codeforces",
      externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemLink is missing", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "codeforces",
      externalProblemId: "1700A",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when site is not a string", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: 42,
      externalProblemId: "1700A",
      externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when site is an empty string", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "   ",
      externalProblemId: "1700A",
      externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemId is an empty string", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "codeforces",
      externalProblemId: "   ",
      externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemLink is an empty string", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "codeforces",
      externalProblemId: "1700A",
      externalProblemLink: "   ",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemLink is not a valid URL", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "codeforces",
      externalProblemId: "1700A",
      externalProblemLink: "not-a-url",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemLink uses a non-http/https scheme", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "codeforces",
      externalProblemId: "1700A",
      externalProblemLink: "ftp://example.com/problem",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemLink hostname does not match the site", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "codeforces",
      externalProblemId: "1700A",
      externalProblemLink: "https://atcoder.jp/contests/abc300/tasks/abc300_c",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toMatch(/codeforces\.com/i);
  });

  it("returns 400 when externalProblemLink does not contain the problem ID", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "codeforces",
      externalProblemId: "1700A",
      externalProblemLink: "https://codeforces.com/problemset/problem/1800/B",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemLink (atcoder) does not contain the problem ID", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "atcoder",
      externalProblemId: "abc300_c",
      externalProblemLink: "https://atcoder.jp/contests/abc100/tasks/abc100_a",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("creates a new problem and returns it with status 200", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "codeforces",
      externalProblemId: "1700A",
      externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.problem).toMatchObject({
      site: "codeforces",
      externalProblemId: "1700A",
      externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
      status: "active",
    });
    expect(typeof body.problem.id).toBe("number");

    // Verify the problem was inserted into the DB
    const row = sqlite
      .prepare("SELECT * FROM problems WHERE site = 'codeforces' AND external_problem_id = '1700A'")
      .get();
    expect(row).toBeTruthy();
  });

  it("returns the existing problem and updates the link when called with a new link for the same site+id", async () => {
    seedProblems(sqlite, [
      { id: 42, site: "atcoder", externalProblemId: "abc300_c", externalProblemLink: "https://atcoder.jp/contests/abc300/tasks/abc300_c" },
    ]);

    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "atcoder",
      externalProblemId: "abc300_c",
      // Use an alternative valid URL that still contains "abc300_c" as a path fragment.
      externalProblemLink: "https://atcoder.jp/contests/abc300_extra/tasks/abc300_c",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.problem.id).toBe(42);
    expect(body.problem).toMatchObject({
      site: "atcoder",
      externalProblemId: "abc300_c",
      externalProblemLink: "https://atcoder.jp/contests/abc300_extra/tasks/abc300_c",
    });

    // Only one row should exist
    const count = (
      sqlite
        .prepare("SELECT COUNT(*) as c FROM problems WHERE site = 'atcoder'")
        .get() as { c: number }
    ).c;
    expect(count).toBe(1);

    // Verify the link was actually updated in the DB
    const row = sqlite
      .prepare("SELECT external_problem_link FROM problems WHERE id = 42")
      .get() as { external_problem_link: string };
    expect(row.external_problem_link).toBe("https://atcoder.jp/contests/abc300_extra/tasks/abc300_c");
  });

  it("trims whitespace from site, externalProblemId and externalProblemLink", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "  qoj  ",
      externalProblemId: "  1234  ",
      externalProblemLink: "  https://qoj.ac/problem/1234  ",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.problem).toMatchObject({
      site: "qoj",
      externalProblemId: "1234",
      externalProblemLink: "https://qoj.ac/problem/1234",
    });

    const row = sqlite
      .prepare("SELECT * FROM problems WHERE site = 'qoj' AND external_problem_id = '1234'")
      .get();
    expect(row).toBeTruthy();
  });
});
