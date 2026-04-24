import { describe, it, expect, beforeEach } from "vitest";
import { createTestDB, seedTestData } from "./testDb";
import { createTranslation, updateTranslation } from "../../../lib/services/translationService";

describe("translationService", () => {
  let db: ReturnType<typeof createTestDB>;
  let seeds: ReturnType<typeof seedTestData>;

  beforeEach(() => {
    db = createTestDB();
    seeds = seedTestData(db);
  });

  it("createTranslation creates a new translation", async () => {
    const t = await createTranslation(db, seeds.user1Id, seeds.problemId, "Hello world");
    expect(t.id).toBeDefined();
    expect(t.content).toBe("Hello world");
    expect(t.authorId).toBe(seeds.user1Id);
    expect(t.problemId).toBe(seeds.problemId);
    expect(t.status).toBe("active");
  });

  it("updateTranslation updates content", async () => {
    const t = await createTranslation(db, seeds.user1Id, seeds.problemId, "Original");
    const updated = await updateTranslation(db, t.id, seeds.user1Id, "Updated");
    expect(updated.content).toBe("Updated");
  });

  it("updateTranslation throws 403 for non-author", async () => {
    const t = await createTranslation(db, seeds.user1Id, seeds.problemId, "Original");
    await expect(updateTranslation(db, t.id, seeds.user2Id, "Updated")).rejects.toMatchObject({ status: 403 });
  });

  it("updateTranslation throws 404 for unknown id", async () => {
    await expect(updateTranslation(db, "nonexistent", seeds.user1Id, "Updated")).rejects.toMatchObject({ status: 404 });
  });
});
