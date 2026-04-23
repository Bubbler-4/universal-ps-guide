import { createApiStore } from "./store.js";
import {
  canonicalizeProblemId,
  jsonResponse,
  normalizeSite,
  parsePositiveInt,
} from "./utils.js";

const VALID_TARGET_TYPES = new Set(["translation", "solution"]);

function badRequest(message) {
  return jsonResponse(400, {
    error: {
      code: "bad_request",
      message,
    },
  });
}

function unauthorized() {
  return jsonResponse(401, {
    error: {
      code: "unauthorized",
      message: "Authentication required",
    },
  });
}

function forbidden(message) {
  return jsonResponse(403, {
    error: {
      code: "forbidden",
      message,
    },
  });
}

function notFound(message) {
  return jsonResponse(404, {
    error: {
      code: "not_found",
      message,
    },
  });
}

function getAuthenticatedUserId(request) {
  const userId = request.headers.get("x-user-id");
  return userId ? userId.trim() : "";
}

async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function withVoteMetadata(entity, targetType, store, userId) {
  return {
    ...entity,
    upvoteCount: store.getVoteCount(targetType, entity.id),
    currentUserUpvoted: store.hasUserUpvoted(userId, targetType, entity.id),
  };
}

function rankByScoreThenNewest(left, right) {
  if (left.upvoteCount !== right.upvoteCount) {
    return right.upvoteCount - left.upvoteCount;
  }

  return String(right.createdAt).localeCompare(String(left.createdAt));
}

export function createApiHandler({ store = createApiStore(), now = () => new Date().toISOString() } = {}) {
  return async function handleApiRequest(request) {
    const { pathname } = new URL(request.url);
    const method = request.method.toUpperCase();
    const segments = pathname.split("/").filter(Boolean);

    if (segments[0] !== "api") {
      return notFound("API route not found");
    }

    const userId = getAuthenticatedUserId(request);

    if (method === "POST" && segments[1] === "problems" && segments[2] === "resolve") {
      const body = await parseJsonBody(request);
      if (!body || typeof body !== "object") {
        return badRequest("Body must be a JSON object");
      }

      const site = normalizeSite(body.site);
      const externalProblemId = canonicalizeProblemId(body.externalProblemId);

      if (!site || !externalProblemId) {
        return badRequest("site and externalProblemId are required");
      }

      const problem = store.resolveProblem(site, externalProblemId, now());
      return jsonResponse(200, { problem });
    }

    if (method === "GET" && segments[1] === "problems" && segments.length === 4) {
      const site = normalizeSite(decodeURIComponent(segments[2]));
      const externalProblemId = canonicalizeProblemId(decodeURIComponent(segments[3]));

      if (!site || !externalProblemId) {
        return badRequest("site and externalProblemId are required");
      }

      const problem = store.getProblemByLookup(site, externalProblemId);
      if (!problem) {
        return notFound("Problem not found");
      }

      const translations = store
        .listTranslationsByProblem(problem.id)
        .map((translation) => withVoteMetadata(translation, "translation", store, userId))
        .sort(rankByScoreThenNewest);

      const solutions = store
        .listSolutionsByProblem(problem.id)
        .map((solution) => withVoteMetadata(solution, "solution", store, userId))
        .sort(rankByScoreThenNewest);

      return jsonResponse(200, {
        problem,
        translations,
        solutions,
      });
    }

    if (method === "POST" && segments[1] === "translations" && segments.length === 2) {
      if (!userId) {
        return unauthorized();
      }

      const body = await parseJsonBody(request);
      if (!body || typeof body !== "object") {
        return badRequest("Body must be a JSON object");
      }

      const site = normalizeSite(body.site);
      const externalProblemId = canonicalizeProblemId(body.externalProblemId);
      const content = typeof body.content === "string" ? body.content.trim() : "";

      if (!site || !externalProblemId || !content) {
        return badRequest("site, externalProblemId, and content are required");
      }

      const timestamp = now();
      const problem = store.resolveProblem(site, externalProblemId, timestamp);
      const translation = store.createTranslation({
        problemId: problem.id,
        authorId: userId,
        content,
        timestamp,
      });

      return jsonResponse(201, {
        translation: withVoteMetadata(translation, "translation", store, userId),
      });
    }

    if (method === "PATCH" && segments[1] === "translations" && segments.length === 3) {
      if (!userId) {
        return unauthorized();
      }

      const id = parsePositiveInt(segments[2]);
      if (!id) {
        return badRequest("Translation id must be a positive integer");
      }

      const body = await parseJsonBody(request);
      if (!body || typeof body !== "object") {
        return badRequest("Body must be a JSON object");
      }

      const content = typeof body.content === "string" ? body.content.trim() : "";
      if (!content) {
        return badRequest("content is required");
      }

      const result = store.updateTranslation(id, userId, content, now());
      if (result.status === "not_found") {
        return notFound("Translation not found");
      }

      if (result.status === "forbidden") {
        return forbidden("Only the author can update this translation");
      }

      return jsonResponse(200, {
        translation: withVoteMetadata(result.translation, "translation", store, userId),
      });
    }

    if (method === "POST" && segments[1] === "solutions" && segments.length === 2) {
      if (!userId) {
        return unauthorized();
      }

      const body = await parseJsonBody(request);
      if (!body || typeof body !== "object") {
        return badRequest("Body must be a JSON object");
      }

      const site = normalizeSite(body.site);
      const externalProblemId = canonicalizeProblemId(body.externalProblemId);
      const content = typeof body.content === "string" ? body.content.trim() : "";

      if (!site || !externalProblemId || !content) {
        return badRequest("site, externalProblemId, and content are required");
      }

      const timestamp = now();
      const problem = store.resolveProblem(site, externalProblemId, timestamp);
      const solution = store.createSolution({
        problemId: problem.id,
        authorId: userId,
        content,
        language: typeof body.language === "string" ? body.language.trim() || null : null,
        difficultyTag:
          typeof body.difficultyTag === "string" ? body.difficultyTag.trim() || null : null,
        approachSummary:
          typeof body.approachSummary === "string"
            ? body.approachSummary.trim() || null
            : null,
        timestamp,
      });

      return jsonResponse(201, {
        solution: withVoteMetadata(solution, "solution", store, userId),
      });
    }

    if (method === "PATCH" && segments[1] === "solutions" && segments.length === 3) {
      if (!userId) {
        return unauthorized();
      }

      const id = parsePositiveInt(segments[2]);
      if (!id) {
        return badRequest("Solution id must be a positive integer");
      }

      const body = await parseJsonBody(request);
      if (!body || typeof body !== "object") {
        return badRequest("Body must be a JSON object");
      }

      const content = typeof body.content === "string" ? body.content.trim() : "";
      if (!content) {
        return badRequest("content is required");
      }

      const result = store.updateSolution(
        id,
        userId,
        {
          content,
          language: typeof body.language === "string" ? body.language.trim() || null : null,
          difficultyTag:
            typeof body.difficultyTag === "string" ? body.difficultyTag.trim() || null : null,
          approachSummary:
            typeof body.approachSummary === "string"
              ? body.approachSummary.trim() || null
              : null,
        },
        now(),
      );

      if (result.status === "not_found") {
        return notFound("Solution not found");
      }

      if (result.status === "forbidden") {
        return forbidden("Only the author can update this solution");
      }

      return jsonResponse(200, {
        solution: withVoteMetadata(result.solution, "solution", store, userId),
      });
    }

    if (method === "POST" && segments[1] === "votes" && segments.length === 2) {
      if (!userId) {
        return unauthorized();
      }

      const body = await parseJsonBody(request);
      if (!body || typeof body !== "object") {
        return badRequest("Body must be a JSON object");
      }

      const targetType = typeof body.targetType === "string" ? body.targetType.trim() : "";
      const targetId = parsePositiveInt(body.targetId);

      if (!VALID_TARGET_TYPES.has(targetType) || !targetId) {
        return badRequest("targetType and targetId are required");
      }

      const target = store.findTargetByType(targetType, targetId);
      if (!target) {
        return notFound("Vote target not found");
      }

      if (target.authorId === userId) {
        return forbidden("Voting on your own content is not allowed");
      }

      store.addVote(userId, targetType, targetId);

      return jsonResponse(200, {
        vote: {
          targetType,
          targetId,
          upvoted: true,
        },
        upvoteCount: store.getVoteCount(targetType, targetId),
      });
    }

    if (method === "DELETE" && segments[1] === "votes" && segments.length === 4) {
      if (!userId) {
        return unauthorized();
      }

      const targetType = segments[2];
      const targetId = parsePositiveInt(segments[3]);

      if (!VALID_TARGET_TYPES.has(targetType) || !targetId) {
        return badRequest("targetType and targetId are required");
      }

      const target = store.findTargetByType(targetType, targetId);
      if (!target) {
        return notFound("Vote target not found");
      }

      store.removeVote(userId, targetType, targetId);

      return jsonResponse(200, {
        vote: {
          targetType,
          targetId,
          upvoted: false,
        },
        upvoteCount: store.getVoteCount(targetType, targetId),
      });
    }

    return notFound("API route not found");
  };
}
