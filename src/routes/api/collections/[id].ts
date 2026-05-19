import type { APIEvent } from "@solidjs/start/server";
import { collectionProblems, collections, problems, users } from "~/db/schema";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getD1 } from "~/server/db";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { MAX_COLLECTION_PROBLEMS, parseProblemsFromBody } from "./validation";

/**
 * GET /api/collections/:id
 * Returns one non-deleted collection and its problems.
 */
export async function GET(event: APIEvent) {
  const id = Number(event.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response(JSON.stringify({ error: "Invalid collection id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getD1(event);

  const collection = await db
    .select({
      id: collections.id,
      authorId: collections.authorId,
      authorUsername: users.username,
      title: collections.title,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
    })
    .from(collections)
    .leftJoin(users, eq(users.id, collections.authorId))
    .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
    .get();

  if (!collection) {
    return new Response(JSON.stringify({ error: "Collection not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const collectionProblemRows = await db
    .select({
      position: collectionProblems.position,
      id: problems.id,
      site: problems.site,
      externalProblemId: problems.externalProblemId,
      externalProblemLink: problems.externalProblemLink,
      shortDescription: collectionProblems.shortDescription,
    })
    .from(collectionProblems)
    .innerJoin(problems, eq(problems.id, collectionProblems.problemId))
    .where(and(eq(collectionProblems.collectionId, id), isNull(problems.deletedAt)))
    .orderBy(asc(collectionProblems.position))
    .all();

  return new Response(
    JSON.stringify({ collection, problems: collectionProblemRows }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * PUT /api/collections/:id
 * Body: { title: string, problemIds: number[] } or { title: string, problems: { id: number, shortDescription?: string }[] }
 * Replaces the collection title and problem list.
 */
export async function PUT(event: APIEvent) {
  const env = getCloudflareEnv(event);
  const session = await getServerSession(event.request, env);
  if (!session || session.needsUsername || !session.dbUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = Number(event.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response(JSON.stringify({ error: "Invalid collection id" }), {
      status: 400,
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

  const parsedProblems = parseProblemsFromBody(rawProblems, rawProblemIds);
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

  const existingCollection = await db
    .select({ id: collections.id, authorId: collections.authorId })
    .from(collections)
    .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
    .get();

  if (!existingCollection) {
    return new Response(JSON.stringify({ error: "Collection not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existingCollection.authorId !== session.dbUserId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

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

  const replaceQueries = [
    db
      .update(collections)
      .set({ title: title.trim(), updatedAt: sql`(datetime('now'))` })
      .where(and(eq(collections.id, id), eq(collections.authorId, session.dbUserId), isNull(collections.deletedAt))),
    db.delete(collectionProblems).where(eq(collectionProblems.collectionId, id)),
    ...(problemIds.length > 0
      ? [
          db.insert(collectionProblems).values(
            collectionProblemData.map((problem, index) => ({
              collectionId: id,
              problemId: problem.id,
              position: index,
              shortDescription: problem.shortDescription,
            }))
          ),
        ]
      : []),
  ];
  console.log(replaceQueries.map(query => query.toSQL()));

  if ("batch" in db && typeof db.batch === "function") {
    await db.batch(replaceQueries);
  } else {
    for (const query of replaceQueries) {
      await query.run();
    }
  }

  const updatedCollection = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.authorId, session.dbUserId), isNull(collections.deletedAt)))
    .get();

  if (!updatedCollection) {
    return new Response(JSON.stringify({ error: "Collection not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ collection: updatedCollection }), {
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * DELETE /api/collections/:id
 * Soft-deletes a collection owned by the authenticated user.
 */
export async function DELETE(event: APIEvent) {
  const env = getCloudflareEnv(event);
  const session = await getServerSession(event.request, env);
  if (!session || session.needsUsername || !session.dbUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = Number(event.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response(JSON.stringify({ error: "Invalid collection id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getD1(event);

  const existingCollection = await db
    .select({ id: collections.id, authorId: collections.authorId })
    .from(collections)
    .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
    .get();

  if (!existingCollection) {
    return new Response(JSON.stringify({ error: "Collection not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existingCollection.authorId !== session.dbUserId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  await db
    .update(collections)
    .set({ deletedAt: sql`(datetime('now'))` })
    .where(and(eq(collections.id, id), eq(collections.authorId, session.dbUserId), isNull(collections.deletedAt)))
    .run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
