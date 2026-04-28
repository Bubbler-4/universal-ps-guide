import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  site TEXT NOT NULL,
  external_problem_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS problems_site_external_problem_id_idx
  ON problems (site, external_problem_id);

CREATE TABLE IF NOT EXISTS translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS translations_problem_id_idx ON translations (problem_id);
`;

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export function createTestDb(): { db: TestDb; sqlite: Database.Database } {
  const sqlite = new Database(":memory:");
  for (const stmt of SCHEMA_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
    sqlite.exec(stmt + ";");
  }
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

/** Seed one or more translation rows using parameterized statements (avoids SQL injection). */
export function seedTranslations(
  sqlite: Database.Database,
  rows: Array<{
    problemId: number;
    userId: number;
    content: string;
    status?: string;
    createdAt?: string;
    deletedAt?: string | null;
  }>
): void {
  const stmt = sqlite.prepare(
    `INSERT INTO translations (problem_id, author_id, content, status, created_at, deleted_at)
     VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?)`
  );
  for (const row of rows) {
    stmt.run(
      row.problemId,
      row.userId,
      row.content,
      row.status ?? "active",
      row.createdAt ?? null,
      row.deletedAt ?? null
    );
  }
}

/** Build a minimal APIEvent-like object for GET requests with route params. */
export function makeParamEvent(params: Record<string, string>): object {
  return {
    params,
    request: {
      url: "http://localhost/",
      json: () => Promise.resolve(null),
    },
    nativeEvent: { context: {} },
  };
}

/** Build a minimal APIEvent-like object for requests with a URL and optional body. */
export function makeRequestEvent(url: string, body?: unknown): object {
  return {
    params: {},
    request: {
      url,
      json: () =>
        body !== undefined ? Promise.resolve(body) : Promise.reject(new SyntaxError("No body")),
    },
    nativeEvent: { context: {} },
  };
}
