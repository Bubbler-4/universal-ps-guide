import { eq, and } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { problems, translations, solutions, votes } from "../../db/schema";
import * as schema from "../../db/schema";

export type AnyDB = DrizzleD1Database<typeof schema> | any;

export function canonicalize(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export async function getOrCreateProblem(db: AnyDB, site: string, externalProblemId: string) {
  const canonicalId = canonicalize(externalProblemId);
  const existing = await db
    .select()
    .from(problems)
    .where(and(eq(problems.site, site), eq(problems.externalProblemId, canonicalId)))
    .get();
  if (existing) return existing;

  const now = Date.now();
  const id = crypto.randomUUID();
  await db.insert(problems).values({
    id,
    site,
    externalProblemId: canonicalId,
    createdAt: now,
    updatedAt: now,
  });
  return { id, site, externalProblemId: canonicalId, createdAt: now, updatedAt: now };
}

export async function getProblemWithContent(db: AnyDB, site: string, externalProblemId: string, userId?: string) {
  const canonicalId = canonicalize(externalProblemId);
  const problem = await db
    .select()
    .from(problems)
    .where(and(eq(problems.site, site), eq(problems.externalProblemId, canonicalId)))
    .get();
  if (!problem) return null;

  const allTranslations = await db
    .select()
    .from(translations)
    .where(eq(translations.problemId, problem.id))
    .all();

  const allSolutions = await db
    .select()
    .from(solutions)
    .where(eq(solutions.problemId, problem.id))
    .all();

  const allVotes = await db.select().from(votes).all();

  function getVoteCount(targetType: string, targetId: string) {
    return allVotes.filter((v: any) => v.targetType === targetType && v.targetId === targetId).length;
  }

  function getUserVote(targetType: string, targetId: string) {
    if (!userId) return false;
    return allVotes.some((v: any) => v.userId === userId && v.targetType === targetType && v.targetId === targetId);
  }

  const translationsWithVotes = allTranslations
    .map((t: any) => ({
      ...t,
      voteCount: getVoteCount("translation", t.id),
      userVoted: getUserVote("translation", t.id),
    }))
    .sort((a: any, b: any) => b.voteCount - a.voteCount || b.createdAt - a.createdAt);

  const solutionsWithVotes = allSolutions
    .map((s: any) => ({
      ...s,
      voteCount: getVoteCount("solution", s.id),
      userVoted: getUserVote("solution", s.id),
    }))
    .sort((a: any, b: any) => b.voteCount - a.voteCount || b.createdAt - a.createdAt);

  return { ...problem, translations: translationsWithVotes, solutions: solutionsWithVotes };
}
