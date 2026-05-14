export const MAX_COLLECTION_PROBLEMS = 100;
export const MAX_COLLECTION_PROBLEM_DESCRIPTION_LENGTH = 200;

export type ParsedCollectionProblem = {
  id: number;
  shortDescription: string | null;
};

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

export function parseCollectionProblems(
  value: unknown
): { valid: true; problems: ParsedCollectionProblem[] } | { valid: false } {
  if (!Array.isArray(value)) {
    return { valid: false };
  }

  const parsed: ParsedCollectionProblem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { valid: false };
    }

    const { id, shortDescription } = item as Record<string, unknown>;
    if (!Number.isInteger(id) || (id as number) <= 0) {
      return { valid: false };
    }

    if (shortDescription !== undefined && shortDescription !== null && typeof shortDescription !== "string") {
      return { valid: false };
    }

    const normalizedDescription = shortDescription?.trim() ?? "";
    if (normalizedDescription.length > MAX_COLLECTION_PROBLEM_DESCRIPTION_LENGTH) {
      return { valid: false };
    }

    parsed.push({
      id: id as number,
      shortDescription: normalizedDescription ? normalizedDescription : null,
    });
  }

  return { valid: true, problems: parsed };
}
