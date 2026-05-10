export const MAX_COLLECTION_PROBLEMS = 100;

export function parseProblemIds(
  value: unknown
): { valid: true; problemIds: number[] } | { valid: false } {
  if (!Array.isArray(value)) {
    return { valid: false };
  }

  const parsed: number[] = [];
  for (const id of value) {
    if (!Number.isInteger(id) || (id as number) <= 0) {
      return { valid: false };
    }
    parsed.push(id as number);
  }

  return { valid: true, problemIds: parsed };
}
