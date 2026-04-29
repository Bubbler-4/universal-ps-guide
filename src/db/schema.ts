import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  githubId: text("github_id").unique(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  status: text("status", { enum: ["active", "hidden", "flagged"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  deletedAt: text("deleted_at"),
});

export const problems = sqliteTable(
  "problems",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    site: text("site").notNull(),
    externalProblemId: text("external_problem_id").notNull(),
    status: text("status", { enum: ["active", "hidden", "flagged"] })
      .notNull()
      .default("active"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    deletedAt: text("deleted_at"),
  },
  (t) => [uniqueIndex("problems_site_external_problem_id_idx").on(t.site, t.externalProblemId)]
);

export const translations = sqliteTable(
  "translations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    problemId: integer("problem_id")
      .notNull()
      .references(() => problems.id),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    status: text("status", { enum: ["active", "hidden", "flagged"] })
      .notNull()
      .default("active"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("translations_problem_id_idx").on(t.problemId),
    uniqueIndex("translations_problem_id_author_id_idx").on(t.problemId, t.authorId),
  ]
);

export type User = typeof users.$inferSelect;
export type Problem = typeof problems.$inferSelect;
export type Translation = typeof translations.$inferSelect;
export type NewTranslation = typeof translations.$inferInsert;
