import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, makeParamEvent, seedTranslations, type TestDb } from "./helpers";
import type { APIEvent } from "@solidjs/start/server";

// Mock the server/db module so GET() uses the in-memory Drizzle instance.
let mockDb: TestDb;
vi.mock("~/server/db", () => ({
  getD1: () => mockDb,
}));

// Import AFTER vi.mock so the mock is applied.
const { GET } = await import("~/routes/api/problems/[site]/[externalProblemId]");

describe("GET /api/problems/:site/:externalProblemId", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    const result = createTestDb();
    sqlite = result.sqlite;
    mockDb = result.db;
  });

  afterEach(() => {
    sqlite.close();
  });

  it("returns 404 when the problem does not exist", async () => {
    const event = makeParamEvent({ site: "codeforces", externalProblemId: "1700A" });
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns problem and empty translations when problem exists with no translations", async () => {
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id) VALUES ('codeforces', '1700A')`
    );
    const event = makeParamEvent({ site: "codeforces", externalProblemId: "1700A" });
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.problem).toMatchObject({ site: "codeforces", externalProblemId: "1700A" });
    expect(body.translations).toEqual([]);
  });

  it("returns active translations ordered by createdAt ascending", async () => {
    sqlite.exec(`INSERT INTO users (username, email) VALUES ('alice', 'alice@example.com')`);
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id) VALUES ('codeforces', '1700A')`
    );
    const problemId = (sqlite.prepare("SELECT id FROM problems LIMIT 1").get() as { id: number }).id;
    const userId = (sqlite.prepare("SELECT id FROM users LIMIT 1").get() as { id: number }).id;
    seedTranslations(sqlite, [
      { problemId, userId, content: "Translation A", createdAt: "2024-01-01 00:00:00" },
      { problemId, userId, content: "Translation B", createdAt: "2024-01-02 00:00:00" },
    ]);

    const event = makeParamEvent({ site: "codeforces", externalProblemId: "1700A" });
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.translations).toHaveLength(2);
    expect(body.translations[0].content).toBe("Translation A");
    expect(body.translations[1].content).toBe("Translation B");
  });

  it("excludes translations with non-active status", async () => {
    sqlite.exec(`INSERT INTO users (username, email) VALUES ('alice', 'alice@example.com')`);
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id) VALUES ('codeforces', '1700A')`
    );
    const problemId = (sqlite.prepare("SELECT id FROM problems LIMIT 1").get() as { id: number }).id;
    const userId = (sqlite.prepare("SELECT id FROM users LIMIT 1").get() as { id: number }).id;
    seedTranslations(sqlite, [
      { problemId, userId, content: "Active", status: "active" },
      { problemId, userId, content: "Hidden", status: "hidden" },
      { problemId, userId, content: "Flagged", status: "flagged" },
    ]);

    const event = makeParamEvent({ site: "codeforces", externalProblemId: "1700A" });
    const res = await GET(event as APIEvent);
    const body = await res.json();
    expect(body.translations).toHaveLength(1);
    expect(body.translations[0].content).toBe("Active");
  });

  it("excludes soft-deleted translations", async () => {
    sqlite.exec(`INSERT INTO users (username, email) VALUES ('alice', 'alice@example.com')`);
    sqlite.exec(
      `INSERT INTO problems (site, external_problem_id) VALUES ('codeforces', '1700A')`
    );
    const problemId = (sqlite.prepare("SELECT id FROM problems LIMIT 1").get() as { id: number }).id;
    const userId = (sqlite.prepare("SELECT id FROM users LIMIT 1").get() as { id: number }).id;
    seedTranslations(sqlite, [
      { problemId, userId, content: "Active", deletedAt: null },
      { problemId, userId, content: "Deleted", deletedAt: "2024-06-01 00:00:00" },
    ]);

    const event = makeParamEvent({ site: "codeforces", externalProblemId: "1700A" });
    const res = await GET(event as APIEvent);
    const body = await res.json();
    expect(body.translations).toHaveLength(1);
    expect(body.translations[0].content).toBe("Active");
  });

  it("returns 400 when site param is empty", async () => {
    const event = makeParamEvent({ site: "", externalProblemId: "1700A" });
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemId param is empty", async () => {
    const event = makeParamEvent({ site: "codeforces", externalProblemId: "" });
    const res = await GET(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
