import { createSignal, For, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { A, cache, createAsync, useNavigate, useParams } from "@solidjs/router";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getServerSession } from "~/lib/auth";
import { useI18n } from "~/lib/i18n";
import { getDb } from "~/db";
import { collectionProblems, collections, problems, users } from "~/db/schema";
import { getCloudflareEnv } from "~/server/env";

type PageData =
  | {
      status: "ok";
      collection: {
        id: number;
        authorId: number;
        authorUsername: string | null;
        title: string;
      };
      problems: {
        id: number;
        site: string;
        externalProblemId: string;
        shortDescription: string | null;
      }[];
      canEdit: boolean;
    }
  | { status: "invalid_id" }
  | { status: "not_found" }
  | { status: "server_error" };

const fetchCollection = cache(async (idParam: string) => {
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
      authorUsername: users.username,
      title: collections.title,
    })
    .from(collections)
    .leftJoin(users, eq(users.id, collections.authorId))
    .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
    .get();

  if (!collection) return { status: "not_found" as const };

  const rows = await db
    .select({
      id: problems.id,
      site: problems.site,
      externalProblemId: problems.externalProblemId,
      shortDescription: collectionProblems.shortDescription,
    })
    .from(collectionProblems)
    .innerJoin(problems, eq(problems.id, collectionProblems.problemId))
    .where(and(eq(collectionProblems.collectionId, id), isNull(problems.deletedAt)))
    .orderBy(asc(collectionProblems.position))
    .all();

  return { status: "ok" as const, collection, problems: rows };
}, "fetchCollection");

const getCollectionData = async (idParam: string): Promise<PageData> => {
  "use server";

  const event = getRequestEvent();
  if (!event) return { status: "server_error" };

  const env = getCloudflareEnv(event);
  if (!env.DB) return { status: "server_error" };

  const data = await fetchCollection(idParam);

  if (data.status !== "ok") {
    return data;
  }

  const session = await getServerSession(event.request, env);
  const canEdit = !!(session && !session.needsUsername && session.dbUserId === data.collection.authorId);

  return { ...data, canEdit };
};

export const route = {
  load: ({ params }: { params: { id: string } }) => getCollectionData(params.id),
};

export default function CollectionPage() {
  const params = useParams<{ id: string }>();
  const data = createAsync(() => getCollectionData(params.id));
  const navigate = useNavigate();
  const { t } = useI18n();

  const [deleting, setDeleting] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);

  const handleDelete = async () => {
    if (!window.confirm(t("confirmDeleteCollection"))) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/collections/${params.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError((body as { error?: string }).error ?? t("failedToDeleteCollection"));
        return;
      }
      navigate("/collections");
    } catch {
      setDeleteError(t("networkError"));
    } finally {
      setDeleting(false);
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

      <Show when={data()?.status === "server_error"}>
        <div class="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">{t("serverError")}</h1>
          <p class="text-red-600 dark:text-red-400">{t("serverErrorDesc")}</p>
        </div>
      </Show>

      <Show when={data()?.status === "ok"}>
        <div class="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {data()?.status === "ok" ? data()!.collection.title : ""}
            </h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {t("creator")}: {data()?.status === "ok" ? data()!.collection.authorUsername ?? t("anonymous") : ""}
            </p>
          </div>
          <Show when={data()?.status === "ok" && data()!.canEdit}>
            <div class="flex gap-2">
              <A
                href={`/collections/${params.id}/edit`}
                class="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {t("editCollection")}
              </A>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting()}
                class="bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-50 disabled:cursor-not-allowed text-red-700 dark:text-red-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {deleting() ? t("deletingEllipsis") : t("deleteCollection")}
              </button>
            </div>
          </Show>
        </div>

        <Show when={deleteError()}>
          <p class="text-sm text-red-600 dark:text-red-400 mb-4">{deleteError()}</p>
        </Show>

        <div class="overflow-x-auto bg-white dark:bg-gray-900 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-6">
          <table class="w-full text-sm text-left text-gray-700 dark:text-gray-300">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="py-2 pr-3 font-semibold">{t("onlineJudgeSiteLabel")}</th>
                <th class="py-2 pr-3 font-semibold">{t("problemIdLabel")}</th>
                <th class="py-2 font-semibold">{t("shortDescription")}</th>
              </tr>
            </thead>
            <tbody>
              <For each={data()?.status === "ok" ? data()!.problems : []}>
                {(row) => (
                  <tr class="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <td class="py-2 pr-3">
                      <A href={`/problems/${row.site}/${encodeURIComponent(row.externalProblemId)}`} class="hover:underline">
                        {row.site}
                      </A>
                    </td>
                    <td class="py-2">
                      <A href={`/problems/${row.site}/${encodeURIComponent(row.externalProblemId)}`} class="hover:underline">
                        {row.externalProblemId}
                      </A>
                    </td>
                    <td class="py-2">{row.shortDescription ?? ""}</td>
                  </tr>
                )}
              </For>
              {(data()?.status === "ok" ? data()!.problems.length : 0) === 0 && (
                <tr>
                  <td colSpan={3} class="py-3 text-gray-500 dark:text-gray-400">
                    {t("noProblemsYet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Show>
    </main>
  );
}
