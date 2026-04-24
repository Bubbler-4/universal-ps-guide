import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../../db/schema";

export function createTestDB() {
  const sqlite = new Database(":memory:");
  
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      site TEXT NOT NULL,
      external_problem_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS problems_site_external_idx ON problems(site, external_problem_id);
    CREATE TABLE IF NOT EXISTS translations (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL REFERENCES problems(id),
      author_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS solutions (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL REFERENCES problems(id),
      author_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      language TEXT,
      difficulty_tag TEXT,
      approach_summary TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS votes_user_target_idx ON votes(user_id, target_type, target_id);
  `);
  
  return drizzle(sqlite, { schema });
}

export function seedTestData(db: ReturnType<typeof createTestDB>) {
  const now = Date.now();
  const user1Id = "user-1";
  const user2Id = "user-2";
  const problemId = "problem-1";

  db.insert(schema.users).values([
    { id: user1Id, username: "alice", email: "alice@example.com", createdAt: now, updatedAt: now },
    { id: user2Id, username: "bob", email: "bob@example.com", createdAt: now, updatedAt: now },
  ]).run();

  db.insert(schema.problems).values({
    id: problemId,
    site: "leetcode",
    externalProblemId: "TWOSUM",
    createdAt: now,
    updatedAt: now,
  }).run();

  return { user1Id, user2Id, problemId, now };
}
