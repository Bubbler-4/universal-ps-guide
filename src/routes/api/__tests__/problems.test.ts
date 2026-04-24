import { describe, it, expect, beforeEach } from "vitest";
import { createTestDB, seedTestData } from "./testDb";
import { getOrCreateProblem, getProblemWithContent, canonicalize } from "../../../lib/services/problemService";

describe("problemService", () => {
  let db: ReturnType<typeof createTestDB>;
  let seeds: ReturnType<typeof seedTestData>;

  beforeEach(() => {
    db = createTestDB();
    seeds = seedTestData(db);
  });

  it("canonicalizes external problem IDs", () => {
    expect(canonicalize("two-sum")).toBe("TWOSUM");
    expect(canonicalize("Two Sum")).toBe("TWOSUM");
    expect(canonicalize("1. Two Sum")).toBe("1TWOSUM");
  });

  it("getOrCreateProblem creates a new problem", async () => {
    const p = await getOrCreateProblem(db, "leetcode", "new-problem");
    expect(p.site).toBe("leetcode");
    expect(p.externalProblemId).toBe("NEWPROBLEM");
    expect(p.id).toBeDefined();
  });

  it("getOrCreateProblem returns existing problem", async () => {
    const p1 = await getOrCreateProblem(db, "leetcode", "two-sum");
    const p2 = await getOrCreateProblem(db, "leetcode", "two-sum");
    expect(p1.id).toBe(p2.id);
  });

  it("getProblemWithContent returns null for unknown problem", async () => {
    const result = await getProblemWithContent(db, "leetcode", "unknown-problem");
    expect(result).toBeNull();
  });

  it("getProblemWithContent returns problem with translations and solutions", async () => {
    const result = await getProblemWithContent(db, "leetcode", "two-sum");
    expect(result).not.toBeNull();
    expect(result!.site).toBe("leetcode");
    expect(result!.translations).toBeInstanceOf(Array);
    expect(result!.solutions).toBeInstanceOf(Array);
  });
});
