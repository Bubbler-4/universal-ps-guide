import { eq } from "drizzle-orm";
import { translations } from "../../db/schema";

export async function createTranslation(db: any, authorId: string, problemId: string, content: string) {
  const now = Date.now();
  const id = crypto.randomUUID();
  const record = { id, problemId, authorId, content, status: "active", createdAt: now, updatedAt: now, deletedAt: null };
  await db.insert(translations).values(record);
  return record;
}

export async function updateTranslation(db: any, id: string, authorId: string, content: string) {
  const existing = await db.select().from(translations).where(eq(translations.id, id)).get();
  if (!existing) throw Object.assign(new Error("Not found"), { status: 404 });
  if (existing.authorId !== authorId) throw Object.assign(new Error("Forbidden"), { status: 403 });
  const now = Date.now();
  await db.update(translations).set({ content, updatedAt: now }).where(eq(translations.id, id));
  return { ...existing, content, updatedAt: now };
}
