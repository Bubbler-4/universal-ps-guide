import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const problems = sqliteTable("problems", {
  id: text("id").primaryKey(),
  site: text("site").notNull(),
  externalProblemId: text("external_problem_id").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => ({
  siteExternalIdx: uniqueIndex("problems_site_external_idx").on(table.site, table.externalProblemId),
}));

export const translations = sqliteTable("translations", {
  id: text("id").primaryKey(),
  problemId: text("problem_id").notNull().references(() => problems.id),
  authorId: text("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const solutions = sqliteTable("solutions", {
  id: text("id").primaryKey(),
  problemId: text("problem_id").notNull().references(() => problems.id),
  authorId: text("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  language: text("language"),
  difficultyTag: text("difficulty_tag"),
  approachSummary: text("approach_summary"),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const votes = sqliteTable("votes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => ({
  userTargetIdx: uniqueIndex("votes_user_target_idx").on(table.userId, table.targetType, table.targetId),
}));
