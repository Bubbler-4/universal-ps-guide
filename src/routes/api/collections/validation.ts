export const MAX_COLLECTION_PROBLEMS = 100;
export const MAX_COLLECTION_PROBLEM_DESCRIPTION_LENGTH = 200;

/**
 * Maximum rows per INSERT statement, chosen so that
 * (COLLECTION_PROBLEM_COLUMNS * COLLECTION_PROBLEM_INSERT_CHUNK_SIZE) ≤ D1's 100-parameter limit.
 * collection_problems has 4 columns, so 20 rows × 4 = 80 parameters per statement.
 */
export const COLLECTION_PROBLEM_INSERT_CHUNK_SIZE = 20;

/** Split an array into consecutive chunks of at most `size` elements. */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

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

export function parseProblemsFromBody(
  rawProblems: unknown,
  rawProblemIds: unknown
): { valid: true; problems: ParsedCollectionProblem[] } | { valid: false } {
  if (rawProblems !== undefined) {
    return parseCollectionProblems(rawProblems);
  }

  const parsedProblemIds = parseProblemIds(rawProblemIds);
  if (!parsedProblemIds.valid) {
    return { valid: false };
  }

  return {
    valid: true,
    problems: parsedProblemIds.problemIds.map((id) => ({
      id,
      shortDescription: null,
    })),
  };
}
