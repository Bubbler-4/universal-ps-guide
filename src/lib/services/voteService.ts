import { eq, and } from "drizzle-orm";
import { votes } from "../../db/schema";

export async function addVote(db: any, userId: string, targetType: string, targetId: string, targetAuthorId: string) {
  if (userId === targetAuthorId) {
    throw Object.assign(new Error("Cannot vote on own content"), { status: 403 });
  }
  const existing = await db
    .select()
    .from(votes)
    .where(and(eq(votes.userId, userId), eq(votes.targetType, targetType), eq(votes.targetId, targetId)))
    .get();
  if (existing) return;
  const id = crypto.randomUUID();
  await db.insert(votes).values({ id, userId, targetType, targetId, createdAt: Date.now() });
}

export async function removeVote(db: any, userId: string, targetType: string, targetId: string) {
  await db
    .delete(votes)
    .where(and(eq(votes.userId, userId), eq(votes.targetType, targetType), eq(votes.targetId, targetId)))
    .run();
}
