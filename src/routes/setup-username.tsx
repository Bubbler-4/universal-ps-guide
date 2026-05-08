import { createSignal, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { redirect } from "@solidjs/router";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import { USERNAME_RE } from "~/lib/username";
import { useI18n } from "~/lib/i18n";

async function checkSession() {
  "use server";
  const event = getRequestEvent();
  if (!event) return;
  const env = getCloudflareEnv(event);
  const session = await getServerSession(event.request, env);
  if (!session) {
    throw redirect("/login");
  }
  if (!session.needsUsername) {
    throw redirect("/");
  }
}

export const route = {
  load: () => checkSession(),
};

export default function SetupUsernamePage() {
  const [username, setUsername] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const { t } = useI18n();

  const validationError = () => {
    const u = username().trim();
    if (u.length === 0) return null;
    if (!USERNAME_RE.test(u))
      return t("usernameValidationError");
    return null;
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    const u = username().trim();
    if (!USERNAME_RE.test(u)) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/setup-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("somethingWentWrong"));
      } else {
        location.replace("/");
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main class="mx-auto max-w-md px-4 py-16">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t("chooseUsername")}</h1>
      <p class="text-gray-500 dark:text-gray-400 mb-8">
        {t("chooseUsernameSubtitle")}
      </p>

      <form onSubmit={handleSubmit} class="flex flex-col gap-4">
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("usernameLabel")}
          </label>
          <input
            id="username"
            type="text"
            autocomplete="off"
            value={username()}
            onInput={e => setUsername(e.currentTarget.value)}
            placeholder={t("usernamePlaceholder")}
            class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <Show when={validationError()}>
            <p class="mt-1 text-sm text-red-600 dark:text-red-400">{validationError()}</p>
          </Show>
        </div>

        <Show when={error()}>
          <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
        </Show>

        <button
          type="submit"
          disabled={submitting() || !USERNAME_RE.test(username().trim())}
          class="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded-lg transition-colors"
        >
          {submitting() ? t("savingEllipsis") : t("saveUsername")}
        </button>
      </form>

      <p class="mt-4 text-xs text-gray-400 dark:text-gray-500">
        {t("usernameAllowedChars")}
      </p>
    </main>
  );
}
