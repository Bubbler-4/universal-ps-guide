import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, makeRequestEvent, type TestDb } from "./helpers";
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
    const event = makeRequestEvent("http://localhost/api/problems/resolve");
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
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when externalProblemId is missing", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "codeforces",
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
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.problem).toMatchObject({
      site: "codeforces",
      externalProblemId: "1700A",
      status: "active",
    });
    expect(typeof body.problem.id).toBe("number");

    // Verify the problem was inserted into the DB
    const row = sqlite
      .prepare("SELECT * FROM problems WHERE site = 'codeforces' AND external_problem_id = '1700A'")
      .get();
    expect(row).toBeTruthy();
  });

  it("returns the existing problem when called again with the same site+id", async () => {
    sqlite.exec(
      `INSERT INTO problems (id, site, external_problem_id) VALUES (42, 'atcoder', 'abc300_c')`
    );

    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "atcoder",
      externalProblemId: "abc300_c",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.problem.id).toBe(42);
    expect(body.problem).toMatchObject({ site: "atcoder", externalProblemId: "abc300_c" });

    // Only one row should exist
    const count = (
      sqlite
        .prepare("SELECT COUNT(*) as c FROM problems WHERE site = 'atcoder'")
        .get() as { c: number }
    ).c;
    expect(count).toBe(1);
  });

  it("trims whitespace from site and externalProblemId", async () => {
    const event = makeRequestEvent("http://localhost/api/problems/resolve", {
      site: "  qoj  ",
      externalProblemId: "  1234  ",
    });
    const res = await POST(event as APIEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.problem).toMatchObject({ site: "qoj", externalProblemId: "1234" });

    const row = sqlite
      .prepare("SELECT * FROM problems WHERE site = 'qoj' AND external_problem_id = '1234'")
      .get();
    expect(row).toBeTruthy();
  });
});
