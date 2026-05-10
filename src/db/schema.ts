import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// better-auth tables
// ---------------------------------------------------------------------------

export const authUser = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const authSession = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
});

export const authAccount = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("account_user_provider_idx").on(table.userId, table.providerId),
    uniqueIndex("account_provider_account_uidx").on(table.providerId, table.accountId),
  ]
);

export const authVerification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

// ---------------------------------------------------------------------------
// Application tables
// ---------------------------------------------------------------------------

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
    externalProblemLink: text("external_problem_link").notNull(),
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
    index("translations_author_id_idx").on(t.authorId),
    uniqueIndex("translations_problem_id_author_id_idx").on(t.problemId, t.authorId),
  ]
);

export const solutions = sqliteTable(
  "solutions",
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
    index("solutions_problem_id_idx").on(t.problemId),
    index("solutions_author_id_idx").on(t.authorId),
  ]
);

export const collections = sqliteTable(
  "collections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("collections_author_id_idx").on(t.authorId)]
);

export const collectionProblems = sqliteTable(
  "collection_problems",
  {
    collectionId: integer("collection_id")
      .notNull()
      .references(() => collections.id),
    problemId: integer("problem_id")
      .notNull()
      .references(() => problems.id),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.problemId] }),
    uniqueIndex("collection_problems_collection_id_position_idx").on(t.collectionId, t.position),
    index("collection_problems_problem_id_idx").on(t.problemId),
  ]
);

export type User = typeof users.$inferSelect;
export type Problem = typeof problems.$inferSelect;
export type Translation = typeof translations.$inferSelect;
export type NewTranslation = typeof translations.$inferInsert;
export type Solution = typeof solutions.$inferSelect;
export type NewSolution = typeof solutions.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
