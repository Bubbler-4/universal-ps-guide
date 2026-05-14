import type { APIEvent } from "@solidjs/start/server";
import { collectionProblems, collections, problems, users } from "~/db/schema";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { getD1 } from "~/server/db";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { MAX_COLLECTION_PROBLEMS, parseCollectionProblems, parseProblemIds } from "./validation";

/**
 * GET /api/collections
 * Returns all non-deleted collections.
 */
export async function GET(event: APIEvent) {
  const db = getD1(event);

  const rows = await db
    .select({
      id: collections.id,
      authorId: collections.authorId,
      authorUsername: users.username,
      title: collections.title,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
      problemCount: count(problems.id),
    })
    .from(collections)
    .leftJoin(users, eq(users.id, collections.authorId))
    .leftJoin(collectionProblems, eq(collectionProblems.collectionId, collections.id))
    .leftJoin(problems, and(eq(problems.id, collectionProblems.problemId), isNull(problems.deletedAt)))
    .where(isNull(collections.deletedAt))
    .groupBy(
      collections.id,
      collections.authorId,
      users.username,
      collections.title,
      collections.createdAt,
      collections.updatedAt
    )
    .orderBy(asc(collections.createdAt))
    .all();

  return new Response(JSON.stringify({ collections: rows }), {
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/collections
 * Body: { title: string, problemIds: number[] } or { title: string, problems: { id: number, shortDescription?: string }[] }
 * Creates a collection for the authenticated user.
 */
export async function POST(event: APIEvent) {
  const env = getCloudflareEnv(event);
  const session = await getServerSession(event.request, env);
  if (!session || session.needsUsername || !session.dbUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await event.request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { title, problemIds: rawProblemIds, problems: rawProblems } = body as Record<string, unknown>;
  if (typeof title !== "string" || !title.trim()) {
    return new Response(JSON.stringify({ error: "title must be a non-empty string" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsedProblems =
    rawProblems !== undefined
      ? parseCollectionProblems(rawProblems)
      : (() => {
          const parsedProblemIds = parseProblemIds(rawProblemIds);
          if (!parsedProblemIds.valid) {
            return { valid: false } as const;
          }
          return {
            valid: true as const,
            problems: parsedProblemIds.problemIds.map((id) => ({ id, shortDescription: null })),
          };
        })();
  if (!parsedProblems.valid) {
    return new Response(
      JSON.stringify({
        error: "Provide problems as an array of { id, shortDescription? } or problemIds as an array of positive integers",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const collectionProblemData = parsedProblems.problems;
  if (collectionProblemData.length > MAX_COLLECTION_PROBLEMS) {
    return new Response(
      JSON.stringify({ error: `A collection can include at most ${MAX_COLLECTION_PROBLEMS} problems` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const problemIds = collectionProblemData.map((problem) => problem.id);
  const uniqueProblemIds = Array.from(new Set(problemIds));
  if (uniqueProblemIds.length !== problemIds.length) {
    return new Response(JSON.stringify({ error: "problemIds must not contain duplicates" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getD1(event);

  if (uniqueProblemIds.length > 0) {
    const existingProblemIds = await db
      .select({ id: problems.id })
      .from(problems)
      .where(and(inArray(problems.id, uniqueProblemIds), isNull(problems.deletedAt)))
      .all();
    if (existingProblemIds.length !== uniqueProblemIds.length) {
      return new Response(JSON.stringify({ error: "All problems in problemIds must exist" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const collection = await (async () => {
    try {
      return await db
        .insert(collections)
        .values({ authorId: session.dbUserId, title: title.trim() })
        .returning()
        .get();
    } catch {
      return null;
    }
  })();

  if (!collection) {
    return new Response(JSON.stringify({ error: "Failed to create collection" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (problemIds.length > 0) {
      await db
        .insert(collectionProblems)
        .values(
          collectionProblemData.map((problem, index) => ({
            collectionId: collection.id,
            problemId: problem.id,
            position: index,
            shortDescription: problem.shortDescription,
          }))
        )
        .run();
    }
  } catch {
    await db.delete(collections).where(eq(collections.id, collection.id)).run().catch(() => undefined);
    return new Response(JSON.stringify({ error: "Failed to create collection" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ collection }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
