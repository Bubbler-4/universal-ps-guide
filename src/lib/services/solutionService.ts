import { eq } from "drizzle-orm";
import { solutions } from "../../db/schema";

export interface SolutionData {
  content: string;
  language?: string | null;
  difficultyTag?: string | null;
  approachSummary?: string | null;
}

export async function createSolution(db: any, authorId: string, problemId: string, data: SolutionData) {
  const now = Date.now();
  const id = crypto.randomUUID();
  const record = {
    id, problemId, authorId,
    content: data.content,
    language: data.language ?? null,
    difficultyTag: data.difficultyTag ?? null,
    approachSummary: data.approachSummary ?? null,
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.insert(solutions).values(record);
  return record;
}

export async function updateSolution(db: any, id: string, authorId: string, data: Partial<SolutionData>) {
  const existing = await db.select().from(solutions).where(eq(solutions.id, id)).get();
  if (!existing) throw Object.assign(new Error("Not found"), { status: 404 });
  if (existing.authorId !== authorId) throw Object.assign(new Error("Forbidden"), { status: 403 });
  const now = Date.now();
  const updates: any = { updatedAt: now };
  if (data.content !== undefined) updates.content = data.content;
  if (data.language !== undefined) updates.language = data.language;
  if (data.difficultyTag !== undefined) updates.difficultyTag = data.difficultyTag;
  if (data.approachSummary !== undefined) updates.approachSummary = data.approachSummary;
  await db.update(solutions).set(updates).where(eq(solutions.id, id));
  return { ...existing, ...updates };
}
