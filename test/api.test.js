import { describe, expect, it } from "vitest";
import { createApiHandler } from "../src/api/handlers.js";

function createRequest(method, path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  let body;

  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body,
  });
}

async function run(handler, method, path, options) {
  const response = await handler(createRequest(method, path, options));
  const text = await response.text();
  return {
    status: response.status,
    data: text ? JSON.parse(text) : null,
  };
}

describe("API handlers", () => {
  it("resolves and canonicalizes problems", async () => {
    const handler = createApiHandler();

    const first = await run(handler, "POST", "/api/problems/resolve", {
      body: {
        site: "Codeforces",
        externalProblemId: "1700-a",
      },
    });

    expect(first.status).toBe(200);
    expect(first.data.problem.site).toBe("Codeforces");
    expect(first.data.problem.externalProblemId).toBe("1700A");

    const second = await run(handler, "POST", "/api/problems/resolve", {
      body: {
        site: "Codeforces",
        externalProblemId: "1700_A",
      },
    });

    expect(second.status).toBe(200);
    expect(second.data.problem.id).toBe(first.data.problem.id);
  });

  it("requires authentication for write endpoints", async () => {
    const handler = createApiHandler();

    const response = await run(handler, "POST", "/api/translations", {
      body: {
        site: "QOJ",
        externalProblemId: "1234",
        content: "Translation text",
      },
    });

    expect(response.status).toBe(401);
    expect(response.data.error.code).toBe("unauthorized");
  });

  it("creates translations and returns ranked problem payloads", async () => {
    const handler = createApiHandler();

    const t1 = await run(handler, "POST", "/api/translations", {
      headers: { "x-user-id": "alice" },
      body: {
        site: "AtCoder",
        externalProblemId: "abc_300-c",
        content: "First translation",
      },
    });

    const t2 = await run(handler, "POST", "/api/translations", {
      headers: { "x-user-id": "bob" },
      body: {
        site: "AtCoder",
        externalProblemId: "abc300c",
        content: "Second translation",
      },
    });

    await run(handler, "POST", "/api/votes", {
      headers: { "x-user-id": "charlie" },
      body: {
        targetType: "translation",
        targetId: t2.data.translation.id,
      },
    });

    const problemPayload = await run(
      handler,
      "GET",
      "/api/problems/AtCoder/abc-300_c",
      {
        headers: { "x-user-id": "charlie" },
      },
    );

    expect(problemPayload.status).toBe(200);
    expect(problemPayload.data.translations).toHaveLength(2);
    expect(problemPayload.data.translations[0].id).toBe(t2.data.translation.id);
    expect(problemPayload.data.translations[0].upvoteCount).toBe(1);
    expect(problemPayload.data.translations[0].currentUserUpvoted).toBe(true);
    expect(problemPayload.data.problem.externalProblemId).toBe("ABC300C");
    expect(t1.status).toBe(201);
  });

  it("enforces translation ownership when updating", async () => {
    const handler = createApiHandler();

    const created = await run(handler, "POST", "/api/translations", {
      headers: { "x-user-id": "alice" },
      body: {
        site: "QOJ",
        externalProblemId: "1000",
        content: "Original",
      },
    });

    const forbidden = await run(
      handler,
      "PATCH",
      `/api/translations/${created.data.translation.id}`,
      {
        headers: { "x-user-id": "bob" },
        body: {
          content: "Hack",
        },
      },
    );

    expect(forbidden.status).toBe(403);

    const updated = await run(
      handler,
      "PATCH",
      `/api/translations/${created.data.translation.id}`,
      {
        headers: { "x-user-id": "alice" },
        body: {
          content: "Updated",
        },
      },
    );

    expect(updated.status).toBe(200);
    expect(updated.data.translation.content).toBe("Updated");
  });

  it("creates and updates solutions with metadata", async () => {
    const handler = createApiHandler();

    const created = await run(handler, "POST", "/api/solutions", {
      headers: { "x-user-id": "alice" },
      body: {
        site: "Codeforces",
        externalProblemId: "1200A",
        content: "Use greedy",
        language: "C++",
        difficultyTag: "easy",
        approachSummary: "simulate transitions",
      },
    });

    expect(created.status).toBe(201);
    expect(created.data.solution.language).toBe("C++");

    const updated = await run(
      handler,
      "PATCH",
      `/api/solutions/${created.data.solution.id}`,
      {
        headers: { "x-user-id": "alice" },
        body: {
          content: "Use prefix sums",
          language: "Rust",
          difficultyTag: "medium",
          approachSummary: "prefix + sweep",
        },
      },
    );

    expect(updated.status).toBe(200);
    expect(updated.data.solution.language).toBe("Rust");
    expect(updated.data.solution.difficultyTag).toBe("medium");
  });

  it("supports upvote and unvote flow and blocks self-votes", async () => {
    const handler = createApiHandler();

    const created = await run(handler, "POST", "/api/solutions", {
      headers: { "x-user-id": "owner" },
      body: {
        site: "Codeforces",
        externalProblemId: "100A",
        content: "My solution",
      },
    });

    const selfVote = await run(handler, "POST", "/api/votes", {
      headers: { "x-user-id": "owner" },
      body: {
        targetType: "solution",
        targetId: created.data.solution.id,
      },
    });

    expect(selfVote.status).toBe(403);

    const vote = await run(handler, "POST", "/api/votes", {
      headers: { "x-user-id": "reader" },
      body: {
        targetType: "solution",
        targetId: created.data.solution.id,
      },
    });

    expect(vote.status).toBe(200);
    expect(vote.data.upvoteCount).toBe(1);

    const unvote = await run(
      handler,
      "DELETE",
      `/api/votes/solution/${created.data.solution.id}`,
      {
        headers: { "x-user-id": "reader" },
      },
    );

    expect(unvote.status).toBe(200);
    expect(unvote.data.upvoteCount).toBe(0);
  });

  it("returns 404 for unknown problems", async () => {
    const handler = createApiHandler();
    const response = await run(handler, "GET", "/api/problems/Codeforces/9999A");

    expect(response.status).toBe(404);
    expect(response.data.error.code).toBe("not_found");
  });
});
