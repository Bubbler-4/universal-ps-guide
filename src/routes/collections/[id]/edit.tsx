import { createEffect, createSignal, For, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { cache, createAsync, redirect, useNavigate, useParams } from "@solidjs/router";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getServerSession } from "~/lib/auth";
import { useI18n } from "~/lib/i18n";
import { SITES, normalizeProblemId } from "~/lib/problems";
import { getDb } from "~/db";
import { collectionProblems, collections, problems } from "~/db/schema";
import { getCloudflareEnv } from "~/server/env";

type SelectedProblem = {
  id: number;
  site: string;
  externalProblemId: string;
};

type EditCollectionData =
  | {
      status: "ok";
      collectionId: number;
      authorId: number;
      title: string;
      problems: SelectedProblem[];
    }
  | { status: "invalid_id" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "server_error" };

const fetchCollectionForEdit = cache(async (idParam: string) => {
  "use server";

  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return { status: "invalid_id" as const };
  }

  const event = getRequestEvent();
  if (!event) return { status: "server_error" as const };

  const env = getCloudflareEnv(event);
  if (!env.DB) return { status: "server_error" as const };

  const db = getDb(env.DB as never);

  const collection = await db
    .select({
      id: collections.id,
      authorId: collections.authorId,
      title: collections.title,
    })
    .from(collections)
    .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
    .get();

  if (!collection) {
    return { status: "not_found" as const };
  }

  const rows = await db
    .select({
      id: problems.id,
      site: problems.site,
      externalProblemId: problems.externalProblemId,
    })
    .from(collectionProblems)
    .innerJoin(problems, eq(problems.id, collectionProblems.problemId))
    .where(and(eq(collectionProblems.collectionId, id), isNull(problems.deletedAt)))
    .orderBy(asc(collectionProblems.position))
    .all();

  return {
    status: "ok" as const,
    collectionId: collection.id,
    authorId: collection.authorId,
    title: collection.title,
    problems: rows,
  };
}, "fetchCollectionForEdit");

const getEditCollectionData = async (idParam: string): Promise<EditCollectionData> => {
  "use server";

  const event = getRequestEvent();
  if (!event) return { status: "server_error" };

  const env = getCloudflareEnv(event);
  if (!env.DB) return { status: "server_error" };

  const session = await getServerSession(event.request, env);
  if (!session) {
    throw redirect("/login");
  }
  if (session.needsUsername) {
    throw redirect("/setup-username");
  }
  if (!session.dbUserId) {
    return { status: "server_error" };
  }

  const data = await fetchCollectionForEdit(idParam);

  if (data.status !== "ok") {
    return data;
  }

  if (data.authorId !== session.dbUserId) {
    return { status: "forbidden" };
  }

  return data;
};

export const route = {
  load: ({ params }: { params: { id: string } }) => getEditCollectionData(params.id),
};

export default function EditCollectionPage() {
  const params = useParams<{ id: string }>();
  const data = createAsync(() => getEditCollectionData(params.id));
  const navigate = useNavigate();
  const { t } = useI18n();

  const [title, setTitle] = createSignal("");
  const [site, setSite] = createSignal(SITES[0].toLowerCase());
  const [problemId, setProblemId] = createSignal("");
  const [selectedProblems, setSelectedProblems] = createSignal<SelectedProblem[]>([]);
  const [initializedCollectionId, setInitializedCollectionId] = createSignal<number | null>(null);
  const [addingProblem, setAddingProblem] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    const d = data();
    if (d?.status === "ok" && initializedCollectionId() !== d.collectionId) {
      setTitle(d.title);
      setSelectedProblems(d.problems);
      setInitializedCollectionId(d.collectionId);
    }
  });

  const removeProblem = (id: number) => {
    setSelectedProblems((prev) => prev.filter((problem) => problem.id !== id));
  };

  const addProblem = async () => {
    const normalizedId = normalizeProblemId(problemId());
    if (!normalizedId) {
      setError(t("collectionProblemIdRequired"));
      return;
    }

    setAddingProblem(true);
    setError(null);
    try {
      const res = await fetch(`/api/problems/${site()}/${encodeURIComponent(normalizedId)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError(t("collectionProblemNotFound"));
          return;
        }
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? t("collectionProblemNotFound"));
        return;
      }

      const body = (await res.json().catch(() => ({}))) as {
        problem?: { id?: number; site?: string; externalProblemId?: string };
      };
      const problem = body.problem;
      if (
        !problem ||
        !Number.isInteger(problem.id) ||
        !problem.site ||
        !problem.externalProblemId
      ) {
        setError(t("collectionProblemNotFound"));
        return;
      }

      if (selectedProblems().some((p) => p.id === problem.id)) {
        setError(t("collectionProblemAlreadyAdded"));
        return;
      }

      setSelectedProblems((prev) => [
        ...prev,
        {
          id: problem.id,
          site: problem.site!,
          externalProblemId: problem.externalProblemId!,
        },
      ]);
      setProblemId("");
    } catch {
      setError(t("networkError"));
    } finally {
      setAddingProblem(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedTitle = title().trim();
    if (!trimmedTitle) {
      setError(t("collectionTitleRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/collections/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          problemIds: selectedProblems().map((problem) => problem.id),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? t("failedToSaveCollection"));
        return;
      }

      navigate(`/collections/${params.id}`);
    } catch {
      setError(t("networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main class="mx-auto max-w-5xl px-4 py-12">
      <Show when={data()?.status === "invalid_id"}>
        <div class="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-yellow-700 dark:text-yellow-300 mb-2">{t("invalidProblem")}</h1>
          <p class="text-yellow-600 dark:text-yellow-400">{t("invalidProblemDesc")}</p>
        </div>
      </Show>

      <Show when={data()?.status === "not_found"}>
        <div class="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">{t("notFound")}</h1>
          <p class="text-red-600 dark:text-red-400">{t("noCollectionsYet")}</p>
        </div>
      </Show>

      <Show when={data()?.status === "forbidden"}>
        <div class="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-yellow-700 dark:text-yellow-300 mb-2">{t("forbidden")}</h1>
          <p class="text-yellow-600 dark:text-yellow-400">{t("forbiddenCollectionEditDesc")}</p>
        </div>
      </Show>

      <Show when={data()?.status === "server_error"}>
        <div class="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">{t("serverError")}</h1>
          <p class="text-red-600 dark:text-red-400">{t("serverErrorDesc")}</p>
        </div>
      </Show>

      <Show when={data()?.status === "ok"}>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">{t("editCollection")}</h1>

        <div class="space-y-6">
          <div>
            <label for="collection-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("collectionTitle")}
            </label>
            <input
              id="collection-title"
              type="text"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              placeholder={t("collectionTitlePlaceholder")}
              class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          <div>
            <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{t("currentProblems")}</h2>
            <div class="overflow-x-auto bg-white dark:bg-gray-900 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-4">
              <table class="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                <thead>
                  <tr class="border-b border-gray-200 dark:border-gray-700">
                    <th class="py-2 pr-3 font-semibold">{t("onlineJudgeSiteLabel")}</th>
                    <th class="py-2 pr-3 font-semibold">{t("problemIdLabel")}</th>
                    <th class="py-2 font-semibold">{t("deleteProblem")}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={selectedProblems()}>
                    {(problem) => (
                      <tr class="border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <td class="py-2 pr-3">{problem.site}</td>
                        <td class="py-2 pr-3">{problem.externalProblemId}</td>
                        <td class="py-2">
                          <button
                            type="button"
                            onClick={() => removeProblem(problem.id)}
                            class="bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 text-sm font-medium px-3 py-1 rounded-lg transition-colors"
                          >
                            {t("deleteProblem")}
                          </button>
                        </td>
                      </tr>
                    )}
                  </For>
                  {selectedProblems().length === 0 && (
                    <tr>
                      <td colSpan={3} class="py-3 text-gray-500 dark:text-gray-400">
                        {t("noProblemsYet")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-4">
            <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{t("addProblemToCollection")}</h2>
            <div class="flex flex-col sm:flex-row gap-3">
              <select
                value={site()}
                onChange={(e) => setSite(e.currentTarget.value)}
                class="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                {SITES.map((name) => (
                  <option value={name.toLowerCase()}>{name}</option>
                ))}
              </select>
              <input
                type="text"
                value={problemId()}
                onInput={(e) => setProblemId(e.currentTarget.value)}
                placeholder={t("problemIdPlaceholder")}
                class="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={addProblem}
                disabled={addingProblem()}
                class="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {addingProblem() ? t("savingEllipsis") : t("addProblem")}
              </button>
            </div>
          </div>

          <Show when={error()}>
            <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
          </Show>

          <div class="flex gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting()}
              class="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {submitting() ? t("savingEllipsis") : t("save")}
            </button>

          </div>
        </div>
      </Show>
    </main>
  );
}
