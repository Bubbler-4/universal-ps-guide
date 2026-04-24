import { describe, it, expect, beforeEach } from "vitest";
import { createTestDB, seedTestData } from "./testDb";
import { createSolution, updateSolution } from "../../../lib/services/solutionService";

describe("solutionService", () => {
  let db: ReturnType<typeof createTestDB>;
  let seeds: ReturnType<typeof seedTestData>;

  beforeEach(() => {
    db = createTestDB();
    seeds = seedTestData(db);
  });

  it("createSolution creates a new solution", async () => {
    const s = await createSolution(db, seeds.user1Id, seeds.problemId, { content: "My solution", language: "python" });
    expect(s.id).toBeDefined();
    expect(s.content).toBe("My solution");
    expect(s.language).toBe("python");
    expect(s.status).toBe("active");
  });

  it("createSolution with optional fields", async () => {
    const s = await createSolution(db, seeds.user1Id, seeds.problemId, {
      content: "Solution",
      difficultyTag: "easy",
      approachSummary: "Hash map approach",
    });
    expect(s.difficultyTag).toBe("easy");
    expect(s.approachSummary).toBe("Hash map approach");
  });

  it("updateSolution updates fields", async () => {
    const s = await createSolution(db, seeds.user1Id, seeds.problemId, { content: "Old content" });
    const updated = await updateSolution(db, s.id, seeds.user1Id, { content: "New content", language: "java" });
    expect(updated.content).toBe("New content");
    expect(updated.language).toBe("java");
  });

  it("updateSolution throws 403 for non-author", async () => {
    const s = await createSolution(db, seeds.user1Id, seeds.problemId, { content: "Content" });
    await expect(updateSolution(db, s.id, seeds.user2Id, { content: "Updated" })).rejects.toMatchObject({ status: 403 });
  });

  it("updateSolution throws 404 for unknown id", async () => {
    await expect(updateSolution(db, "nonexistent", seeds.user1Id, { content: "Updated" })).rejects.toMatchObject({ status: 404 });
  });
});
