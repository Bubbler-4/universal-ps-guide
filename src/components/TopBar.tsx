import { Show } from "solid-js";
import { A } from "@solidjs/router";
import type { AppSession } from "~/lib/auth";
import { useI18n } from "~/lib/i18n";

interface TopBarProps {
  session: AppSession | null;
}

export default function TopBar(props: TopBarProps) {
  const { t, lang, toggleLang } = useI18n();

  return (
    <header class="bg-gray-900 text-white shadow-md">
      <div class="mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
        <A href="/" class="text-xl font-bold tracking-tight hover:text-gray-300 transition-colors">
          Universal PS Guide
        </A>
        <nav class="flex items-center gap-4 text-sm">
          <Show
            when={props.session}
            fallback={
              <A
                href="/login"
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
              >
                {t("login")}
              </A>
            }
          >
            <Show
              when={props.session?.needsUsername}
              fallback={
                <span class="text-gray-300">
                  {t("signedInAs")}{" "}
                  <span class="font-semibold text-white">{props.session?.username}</span>
                </span>
              }
            >
              <A
                href="/setup-username"
                class="text-blue-300 hover:text-blue-200 font-medium transition-colors"
              >
                {t("finishSetup")}
              </A>
            </Show>
            <a
              href="/api/auth/signout"
              target="_self"
              class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              {t("logout")}
            </a>
          </Show>
          <button
            type="button"
            onClick={toggleLang}
            class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-md font-medium transition-colors"
            aria-label="Toggle language"
          >
            {lang() === "en" ? "한국어" : "English"}
          </button>
        </nav>
      </div>
    </header>
  );
}
