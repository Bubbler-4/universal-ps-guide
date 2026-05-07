import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, type TestDb } from "./helpers";
import type { APIEvent } from "@solidjs/start/server";
import type { AppSession } from "~/lib/auth";

// Mock the server/db module so PATCH uses the in-memory Drizzle instance.
let mockDb: TestDb;
vi.mock("~/server/db", () => ({
  getD1: () => mockDb,
}));

// Mock auth so PATCH tests can control the session without real OAuth.
let mockSession: AppSession | null = null;
vi.mock("~/lib/auth", () => ({
  getServerSession: () => Promise.resolve(mockSession),
}));

// Mock env so getCloudflareEnv doesn't throw in test context.
vi.mock("~/server/env", () => ({
  getCloudflareEnv: () => ({}),
}));

// Import AFTER vi.mock so the mock is applied.
const { PATCH } = await import("~/routes/api/problems/[site]/[externalProblemId]");

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

function makePatchEvent(site: string, externalProblemId: string, body: unknown) {
  return {
    params: { site, externalProblemId },
    request: new Request(`http://localhost/api/problems/${site}/${externalProblemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    nativeEvent: { context: {} },
  };
}

describe("PATCH /api/problems/:site/:externalProblemId", () => {
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
    const event = makePatchEvent("codeforces", "1700A", {
      externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
    });
    const res = await PATCH(event as APIEvent);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 404 when problem does not exist", async () => {
    const event = makePatchEvent("codeforces", "1700A", {
      externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
    });
    const res = await PATCH(event as APIEvent);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemLink is missing from body", async () => {
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id, external_problem_link) VALUES ('codeforces', '1700A', 'https://codeforces.com/problemset/problem/1700/A')`
    );
    const event = makePatchEvent("codeforces", "1700A", {});
    const res = await PATCH(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemLink is not a valid URL", async () => {
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id, external_problem_link) VALUES ('codeforces', '1700A', 'https://codeforces.com/problemset/problem/1700/A')`
    );
    const event = makePatchEvent("codeforces", "1700A", { externalProblemLink: "not-a-url" });
    const res = await PATCH(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemLink uses a non-http/https scheme", async () => {
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id, external_problem_link) VALUES ('codeforces', '1700A', 'https://codeforces.com/problemset/problem/1700/A')`
    );
    const event = makePatchEvent("codeforces", "1700A", {
      externalProblemLink: "ftp://example.com/problem",
    });
    const res = await PATCH(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemLink is an empty string", async () => {
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id, external_problem_link) VALUES ('codeforces', '1700A', 'https://codeforces.com/problemset/problem/1700/A')`
    );
    const event = makePatchEvent("codeforces", "1700A", { externalProblemLink: "   " });
    const res = await PATCH(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("updates externalProblemLink and returns the updated problem", async () => {
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id, external_problem_link) VALUES ('codeforces', '1700A', 'https://codeforces.com/problemset/problem/1700/A')`
    );
    const event = makePatchEvent("codeforces", "1700A", {
      externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
    });
    const res = await PATCH(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.problem).toMatchObject({
      site: "codeforces",
      externalProblemId: "1700A",
      externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
    });
  });

  it("overwrites an existing link with a new one", async () => {
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id, external_problem_link)
       VALUES ('codeforces', '1700A', 'https://old-link.example.com')`
    );
    const event = makePatchEvent("codeforces", "1700A", {
      externalProblemLink: "https://codeforces.com/problemset/problem/1700/A",
    });
    const res = await PATCH(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.problem.externalProblemLink).toBe(
      "https://codeforces.com/problemset/problem/1700/A"
    );
  });

  it("trims whitespace from externalProblemLink", async () => {
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id, external_problem_link) VALUES ('codeforces', '1700A', 'https://codeforces.com/problemset/problem/1700/A')`
    );
    const event = makePatchEvent("codeforces", "1700A", {
      externalProblemLink: "  https://codeforces.com/problemset/problem/1700/A  ",
    });
    const res = await PATCH(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.problem.externalProblemLink).toBe(
      "https://codeforces.com/problemset/problem/1700/A"
    );
  });
});
