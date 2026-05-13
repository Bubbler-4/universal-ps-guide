import { createSignal, For, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { A, cache, createAsync, redirect, useNavigate } from "@solidjs/router";
import { getServerSession } from "~/lib/auth";
import { moveItemDown, moveItemUp, reorderItems } from "~/lib/collections";
import { useI18n } from "~/lib/i18n";
import { SITES, normalizeProblemId } from "~/lib/problems";
import { getCloudflareEnv } from "~/server/env";

type AddCollectionData = { status: "ok" } | { status: "server_error" };

type SelectedProblem = {
  id: number;
  site: string;
  externalProblemId: string;
};

const getAddCollectionData = cache(async (): Promise<AddCollectionData> => {
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

  return { status: "ok" };
}, "getAddCollectionData");

export const route = {
  load: () => getAddCollectionData(),
};

export default function AddCollectionPage() {
  const data = createAsync(() => getAddCollectionData());
  const navigate = useNavigate();
  const { t } = useI18n();

  const [title, setTitle] = createSignal("");
  const [site, setSite] = createSignal(SITES[0].toLowerCase());
  const [problemId, setProblemId] = createSignal("");
  const [selectedProblems, setSelectedProblems] = createSignal<SelectedProblem[]>([]);
  const [draggedProblemId, setDraggedProblemId] = createSignal<number | null>(null);
  const [addingProblem, setAddingProblem] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const removeProblem = (id: number) => {
    setSelectedProblems((prev) => prev.filter((problem) => problem.id !== id));
  };

  const reorderProblems = (sourceProblemId: number, targetProblemId: number) => {
    if (sourceProblemId === targetProblemId) {
      return;
    }

    setSelectedProblems((prev) => {
      const sourceIndex = prev.findIndex((problem) => problem.id === sourceProblemId);
      const targetIndex = prev.findIndex((problem) => problem.id === targetProblemId);

      return reorderItems(prev, sourceIndex, targetIndex);
    });
  };

  const moveProblemUp = (problemId: number) => {
    setSelectedProblems((prev) => {
      const index = prev.findIndex((problem) => problem.id === problemId);
      return moveItemUp(prev, index);
    });
  };

  const moveProblemDown = (problemId: number) => {
    setSelectedProblems((prev) => {
      const index = prev.findIndex((problem) => problem.id === problemId);
      return moveItemDown(prev, index);
    });
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
      const res = await fetch("/api/collections", {
        method: "POST",
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

      const body = (await res.json().catch(() => ({}))) as { collection?: { id?: number } };
      if (!body.collection?.id || !Number.isInteger(body.collection.id)) {
        setError(t("failedToSaveCollection"));
        return;
      }

      navigate(`/collections/${body.collection.id}`);
    } catch {
      setError(t("networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main class="mx-auto max-w-5xl px-4 py-12">
      <Show when={data()?.status === "server_error"}>
        <div class="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">{t("serverError")}</h1>
          <p class="text-red-600 dark:text-red-400">{t("serverErrorDesc")}</p>
        </div>
      </Show>

      <Show when={data()?.status === "ok"}>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">{t("addCollection")}</h1>

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
          <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">{t("dragToReorderProblems")}</p>
          <div class="overflow-x-auto bg-white dark:bg-gray-900 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-4">
            <table class="w-full text-sm text-left text-gray-700 dark:text-gray-300">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-700">
                  <th class="py-2 pr-3 font-semibold">{t("reorder")}</th>
                  <th class="py-2 pr-3 font-semibold text-center">
                    <span class="sr-only">{t("moveUp")}</span>
                    <span aria-hidden="true">↑</span>
                  </th>
                  <th class="py-2 pr-3 font-semibold text-center">
                    <span class="sr-only">{t("moveDown")}</span>
                    <span aria-hidden="true">↓</span>
                  </th>
                  <th class="py-2 pr-3 font-semibold">{t("onlineJudgeSiteLabel")}</th>
                  <th class="py-2 pr-3 font-semibold">{t("problemIdLabel")}</th>
                  <th class="py-2 font-semibold">{t("deleteProblem")}</th>
                </tr>
              </thead>
              <tbody>
                <For each={selectedProblems()}>
                  {(problem, index) => (
                    <tr
                      draggable={selectedProblems().length > 1}
                      onDragStart={(event) => {
                        setDraggedProblemId(problem.id);
                        event.dataTransfer?.setData("text/plain", String(problem.id));
                        if (event.dataTransfer) {
                          event.dataTransfer.effectAllowed = "move";
                        }
                      }}
                      onDragOver={(event) => {
                        if (draggedProblemId() === null || draggedProblemId() === problem.id) {
                          return;
                        }

                        event.preventDefault();
                        if (event.dataTransfer) {
                          event.dataTransfer.dropEffect = "move";
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const sourceProblemId = draggedProblemId();
                        setDraggedProblemId(null);
                        if (sourceProblemId !== null) {
                          reorderProblems(sourceProblemId, problem.id);
                        }
                      }}
                      onDragEnd={() => setDraggedProblemId(null)}
                      class="border-b border-gray-100 dark:border-gray-800 last:border-0"
                      classList={{
                        "opacity-50": draggedProblemId() === problem.id,
                        "cursor-grab active:cursor-grabbing": selectedProblems().length > 1,
                      }}
                    >
                      <td class="py-2 pr-3 text-gray-400 dark:text-gray-500 select-none" aria-label={t("dragToReorderProblems")}>
                        <span aria-hidden="true">⋮⋮</span>
                      </td>
                      <td class="py-2 pr-3 text-center">
                        <button
                          type="button"
                          onClick={() => moveProblemUp(problem.id)}
                          disabled={index() === 0}
                          aria-label={t("moveUp")}
                          class="inline-flex items-center justify-center rounded-lg p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <span aria-hidden="true">↑</span>
                        </button>
                      </td>
                      <td class="py-2 pr-3 text-center">
                        <button
                          type="button"
                          onClick={() => moveProblemDown(problem.id)}
                          disabled={index() === selectedProblems().length - 1}
                          aria-label={t("moveDown")}
                          class="inline-flex items-center justify-center rounded-lg p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <span aria-hidden="true">↓</span>
                        </button>
                      </td>
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
                    <td colSpan={6} class="py-3 text-gray-500 dark:text-gray-400">
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
          <A
            href="/collections"
            class="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {t("goHome")}
          </A>
        </div>
      </div>
      </Show>
    </main>
  );
}
