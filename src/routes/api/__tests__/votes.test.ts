import { describe, it, expect, beforeEach } from "vitest";
import { createTestDB, seedTestData } from "./testDb";
import { addVote, removeVote } from "../../../lib/services/voteService";
import { createTranslation } from "../../../lib/services/translationService";
import { createSolution } from "../../../lib/services/solutionService";
import * as schema from "../../../db/schema";
import { eq, and } from "drizzle-orm";

describe("voteService", () => {
  let db: ReturnType<typeof createTestDB>;
  let seeds: ReturnType<typeof seedTestData>;

  beforeEach(() => {
    db = createTestDB();
    seeds = seedTestData(db);
  });

  it("addVote adds a vote", async () => {
    const t = await createTranslation(db, seeds.user1Id, seeds.problemId, "Content");
    await addVote(db, seeds.user2Id, "translation", t.id, seeds.user1Id);
    const vote = await db.select().from(schema.votes)
      .where(and(eq(schema.votes.userId, seeds.user2Id), eq(schema.votes.targetId, t.id)))
      .get();
    expect(vote).toBeDefined();
  });

  it("addVote ignores duplicate votes", async () => {
    const t = await createTranslation(db, seeds.user1Id, seeds.problemId, "Content");
    await addVote(db, seeds.user2Id, "translation", t.id, seeds.user1Id);
    await addVote(db, seeds.user2Id, "translation", t.id, seeds.user1Id);
    const allVotes = await db.select().from(schema.votes).where(eq(schema.votes.targetId, t.id)).all();
    expect(allVotes).toHaveLength(1);
  });

  it("addVote throws 403 when voting on own content", async () => {
    const t = await createTranslation(db, seeds.user1Id, seeds.problemId, "Content");
    await expect(addVote(db, seeds.user1Id, "translation", t.id, seeds.user1Id)).rejects.toMatchObject({ status: 403 });
  });

  it("removeVote removes a vote", async () => {
    const t = await createTranslation(db, seeds.user1Id, seeds.problemId, "Content");
    await addVote(db, seeds.user2Id, "translation", t.id, seeds.user1Id);
    await removeVote(db, seeds.user2Id, "translation", t.id);
    const vote = await db.select().from(schema.votes)
      .where(and(eq(schema.votes.userId, seeds.user2Id), eq(schema.votes.targetId, t.id)))
      .get();
    expect(vote).toBeUndefined();
  });

  it("removeVote on non-existent vote does not throw", async () => {
    await expect(removeVote(db, seeds.user2Id, "translation", "nonexistent")).resolves.not.toThrow();
  });
});
