import { For, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { A, cache, createAsync, redirect } from "@solidjs/router";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getServerSession } from "~/lib/auth";
import { useI18n } from "~/lib/i18n";
import { getDb } from "~/db";
import { collectionProblems, collections, problems, users } from "~/db/schema";
import { getCloudflareEnv } from "~/server/env";

const PAGE_SIZE = 50;

type CollectionRow = {
  id: number;
  title: string;
  authorUsername: string | null;
  problemCount: number;
};

type CollectionsPageData =
  | {
      status: "ok";
      rows: CollectionRow[];
      page: number;
      totalPages: number;
      isLoggedIn: boolean;
    }
  | { status: "server_error" };

const getCollectionsPageData = async (): Promise<CollectionsPageData> => {
  "use server";

  const event = getRequestEvent();
  if (!event) return { status: "server_error" };

  const env = getCloudflareEnv(event);
  if (!env.DB) return { status: "server_error" };

  const url = new URL(event.request.url);
  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const session = await getServerSession(event.request, env);
  const isLoggedIn = !!(session && !session.needsUsername && session.dbUserId);
  const db = getDb(env.DB as never);

  const totalCountRow = await db
    .select({ total: count() })
    .from(collections)
    .where(isNull(collections.deletedAt))
    .get();
  const totalCount = Number(totalCountRow?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (totalCount > 0 && page > totalPages) {
    throw redirect(totalPages === 1 ? "/collections" : `/collections?page=${totalPages}`, 302);
  }

  const rows = await db
    .select({
      id: collections.id,
      title: collections.title,
      authorUsername: users.username,
      problemCount: count(problems.id),
    })
    .from(collections)
    .leftJoin(users, eq(users.id, collections.authorId))
    .leftJoin(collectionProblems, eq(collectionProblems.collectionId, collections.id))
    .leftJoin(problems, and(eq(problems.id, collectionProblems.problemId), isNull(problems.deletedAt)))
    .where(isNull(collections.deletedAt))
    .groupBy(collections.id, collections.title, users.username)
    .orderBy(desc(collections.updatedAt), desc(collections.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { status: "ok", rows, page, totalPages, isLoggedIn };
};

export const route = {
  load: () => getCollectionsPageData(),
};

export default function CollectionsPage() {
  const data = createAsync(() => getCollectionsPageData());
  const { t, tf } = useI18n();

  const pageHref = (page: number) => (page <= 1 ? "/collections" : `/collections?page=${page}`);

  return (
    <main class="mx-auto max-w-5xl px-4 py-12">
      <Show when={data()?.status === "server_error"}>
        <div class="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
          <h1 class="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">{t("serverError")}</h1>
          <p class="text-red-600 dark:text-red-400">{t("serverErrorDesc")}</p>
        </div>
      </Show>

      <Show when={data()?.status === "ok"}>
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{t("collectionsNav")}</h1>
          <Show when={data()?.status === "ok" && data()!.isLoggedIn}>
            <A
              href="/collections/new"
              class="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {t("addCollection")}
            </A>
          </Show>
        </div>

        <div class="overflow-x-auto bg-white dark:bg-gray-900 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-6">
          <table class="w-full text-sm text-left text-gray-700 dark:text-gray-300">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="py-2 pr-3 font-semibold">{t("collectionId")}</th>
                <th class="py-2 pr-3 font-semibold">{t("collectionName")}</th>
                <th class="py-2 pr-3 font-semibold">{t("creator")}</th>
                <th class="py-2 font-semibold">{t("problemCount")}</th>
              </tr>
            </thead>
            <tbody>
              <For each={data()?.status === "ok" ? data()!.rows : []}>
                {(row) => (
                  <tr class="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <td class="py-2 pr-3">
                      <A href={`/collections/${row.id}`} class="hover:underline">
                        {row.id}
                      </A>
                    </td>
                    <td class="py-2 pr-3">
                      <A href={`/collections/${row.id}`} class="hover:underline">
                        {row.title}
                      </A>
                    </td>
                    <td class="py-2 pr-3">{row.authorUsername ?? t("anonymous")}</td>
                    <td class="py-2">{row.problemCount}</td>
                  </tr>
                )}
              </For>
              {(data()?.status === "ok" ? data()!.rows.length : 0) === 0 && (
                <tr>
                  <td colSpan={4} class="py-3 text-gray-500 dark:text-gray-400">
                    {t("noCollectionsYet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Show when={data()?.status === "ok" && data()!.totalPages > 1}>
          <div class="mt-6 flex items-center justify-center gap-4">
            <Show when={data()!.page > 1}>
              <A
                href={pageHref(data()!.page - 1)}
                class="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {t("previous")}
              </A>
            </Show>
            <p class="text-sm text-gray-600 dark:text-gray-300">
              {tf("pageXofY", { x: data()!.page, y: data()!.totalPages })}
            </p>
            <Show when={data()!.page < data()!.totalPages}>
              <A
                href={pageHref(data()!.page + 1)}
                class="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {t("next")}
              </A>
            </Show>
          </div>
        </Show>
      </Show>
    </main>
  );
}
