import { canonicalizeProblemId, normalizeSite } from "./utils.js";

function copyProblem(problem) {
  return {
    id: problem.id,
    site: problem.site,
    externalProblemId: problem.externalProblemId,
    createdAt: problem.createdAt,
    updatedAt: problem.updatedAt,
  };
}

function copyTranslation(translation) {
  return {
    id: translation.id,
    problemId: translation.problemId,
    authorId: translation.authorId,
    content: translation.content,
    createdAt: translation.createdAt,
    updatedAt: translation.updatedAt,
  };
}

function copySolution(solution) {
  return {
    id: solution.id,
    problemId: solution.problemId,
    authorId: solution.authorId,
    content: solution.content,
    language: solution.language,
    difficultyTag: solution.difficultyTag,
    approachSummary: solution.approachSummary,
    createdAt: solution.createdAt,
    updatedAt: solution.updatedAt,
  };
}

function targetKey(targetType, targetId) {
  return `${targetType}:${targetId}`;
}

function voteKey(userId, targetType, targetId) {
  return `${userId}:${targetType}:${targetId}`;
}

export function createApiStore() {
  let nextProblemId = 1;
  let nextTranslationId = 1;
  let nextSolutionId = 1;

  const problemsByLookupKey = new Map();
  const problemsById = new Map();
  const translationsById = new Map();
  const solutionsById = new Map();
  const votesByUserAndTarget = new Map();
  const votesByTarget = new Map();

  function problemLookupKey(site, externalProblemId) {
    return `${normalizeSite(site).toLowerCase()}::${canonicalizeProblemId(externalProblemId)}`;
  }

  function ensureVoteBucket(targetType, targetId) {
    const key = targetKey(targetType, targetId);
    if (!votesByTarget.has(key)) {
      votesByTarget.set(key, new Set());
    }

    return votesByTarget.get(key);
  }

  function getProblemByLookup(site, externalProblemId) {
    const key = problemLookupKey(site, externalProblemId);
    const id = problemsByLookupKey.get(key);
    if (!id) {
      return null;
    }

    return copyProblem(problemsById.get(id));
  }

  function resolveProblem(site, externalProblemId, timestamp) {
    const normalizedSite = normalizeSite(site);
    const canonicalId = canonicalizeProblemId(externalProblemId);
    const key = problemLookupKey(normalizedSite, canonicalId);

    const existingId = problemsByLookupKey.get(key);
    if (existingId) {
      const current = problemsById.get(existingId);
      current.updatedAt = timestamp;
      return copyProblem(current);
    }

    const created = {
      id: nextProblemId++,
      site: normalizedSite,
      externalProblemId: canonicalId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    problemsById.set(created.id, created);
    problemsByLookupKey.set(key, created.id);
    return copyProblem(created);
  }

  function createTranslation(input) {
    const created = {
      id: nextTranslationId++,
      problemId: input.problemId,
      authorId: input.authorId,
      content: input.content,
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
    };

    translationsById.set(created.id, created);
    return copyTranslation(created);
  }

  function getTranslationById(id) {
    const value = translationsById.get(id);
    return value ? copyTranslation(value) : null;
  }

  function updateTranslation(id, authorId, content, timestamp) {
    const current = translationsById.get(id);
    if (!current) {
      return { status: "not_found" };
    }

    if (current.authorId !== authorId) {
      return { status: "forbidden" };
    }

    current.content = content;
    current.updatedAt = timestamp;

    return {
      status: "ok",
      translation: copyTranslation(current),
    };
  }

  function listTranslationsByProblem(problemId) {
    return Array.from(translationsById.values())
      .filter((translation) => translation.problemId === problemId)
      .map(copyTranslation);
  }

  function createSolution(input) {
    const created = {
      id: nextSolutionId++,
      problemId: input.problemId,
      authorId: input.authorId,
      content: input.content,
      language: input.language ?? null,
      difficultyTag: input.difficultyTag ?? null,
      approachSummary: input.approachSummary ?? null,
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
    };

    solutionsById.set(created.id, created);
    return copySolution(created);
  }

  function getSolutionById(id) {
    const value = solutionsById.get(id);
    return value ? copySolution(value) : null;
  }

  function updateSolution(id, authorId, update, timestamp) {
    const current = solutionsById.get(id);
    if (!current) {
      return { status: "not_found" };
    }

    if (current.authorId !== authorId) {
      return { status: "forbidden" };
    }

    current.content = update.content;
    current.language = update.language ?? null;
    current.difficultyTag = update.difficultyTag ?? null;
    current.approachSummary = update.approachSummary ?? null;
    current.updatedAt = timestamp;

    return {
      status: "ok",
      solution: copySolution(current),
    };
  }

  function listSolutionsByProblem(problemId) {
    return Array.from(solutionsById.values())
      .filter((solution) => solution.problemId === problemId)
      .map(copySolution);
  }

  function addVote(userId, targetType, targetId) {
    const key = voteKey(userId, targetType, targetId);
    if (votesByUserAndTarget.has(key)) {
      return false;
    }

    votesByUserAndTarget.set(key, { userId, targetType, targetId });
    ensureVoteBucket(targetType, targetId).add(userId);
    return true;
  }

  function removeVote(userId, targetType, targetId) {
    const key = voteKey(userId, targetType, targetId);
    const existing = votesByUserAndTarget.get(key);
    if (!existing) {
      return false;
    }

    votesByUserAndTarget.delete(key);
    ensureVoteBucket(targetType, targetId).delete(userId);
    return true;
  }

  function getVoteCount(targetType, targetId) {
    return ensureVoteBucket(targetType, targetId).size;
  }

  function hasUserUpvoted(userId, targetType, targetId) {
    if (!userId) {
      return false;
    }

    return votesByUserAndTarget.has(voteKey(userId, targetType, targetId));
  }

  function findTargetByType(targetType, targetId) {
    if (targetType === "translation") {
      const translation = translationsById.get(targetId);
      return translation ? { ...translation, targetType } : null;
    }

    if (targetType === "solution") {
      const solution = solutionsById.get(targetId);
      return solution ? { ...solution, targetType } : null;
    }

    return null;
  }

  return {
    getProblemByLookup,
    resolveProblem,
    createTranslation,
    getTranslationById,
    updateTranslation,
    listTranslationsByProblem,
    createSolution,
    getSolutionById,
    updateSolution,
    listSolutionsByProblem,
    addVote,
    removeVote,
    getVoteCount,
    hasUserUpvoted,
    findTargetByType,
  };
}
