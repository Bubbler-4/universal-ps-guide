import { Show, createSignal } from "solid-js";
import { A } from "@solidjs/router";
import type { AppSession } from "~/lib/auth";
import { useI18n } from "~/lib/i18n";

interface TopBarProps {
  session: AppSession | null;
}

export default function TopBar(props: TopBarProps) {
  const { t, lang, toggleLang } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);

  return (
    <header class="bg-gray-900 text-white shadow-md dark:bg-gray-950">
      <div class="mx-auto max-w-5xl px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3 sm:gap-6">
            <A
              href="/"
              class="text-xl font-bold tracking-tight hover:text-gray-300 dark:hover:text-gray-200 transition-colors"
            >
              Universal PS Guide
            </A>
            <nav class="hidden items-center gap-6 sm:flex">
              <A
                href="/collections"
                class="text-base text-gray-200 hover:text-white dark:text-gray-300 dark:hover:text-gray-100 font-medium transition-colors"
              >
                {t("collectionsNav")}
              </A>
              <A
                href="/faq"
                class="text-base text-gray-200 hover:text-white dark:text-gray-300 dark:hover:text-gray-100 font-medium transition-colors"
              >
                {t("faqNav")}
              </A>
            </nav>
          </div>
          <div class="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(open => !open)}
              class="rounded-md bg-gray-700 px-3 py-2 font-medium text-white transition-colors hover:bg-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 sm:hidden"
              aria-controls="mobile-topbar-menu"
              aria-expanded={mobileMenuOpen()}
            >
              {mobileMenuOpen() ? t("hideMenu") : t("showMenu")}
            </button>
            <nav class="flex items-center gap-2 text-sm sm:gap-4">
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
                    <span class="text-gray-300 dark:text-gray-400">
                      {t("signedInAs")}{" "}
                      <span class="font-semibold text-white dark:text-gray-100">{props.session?.username}</span>
                    </span>
                  }
                >
                  <A
                    href="/setup-username"
                    class="text-blue-300 hover:text-blue-200 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    {t("finishSetup")}
                  </A>
                </Show>
                <a
                  href="/api/auth/signout"
                  target="_self"
                  class="bg-gray-700 hover:bg-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  {t("logout")}
                </a>
              </Show>
              <button
                type="button"
                onClick={toggleLang}
                class="bg-gray-700 hover:bg-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 text-white px-3 py-2 rounded-md font-medium transition-colors"
                aria-label={lang() === "en" ? t("switchToKorean") : t("switchToEnglish")}
              >
                {lang() === "en" ? "한국어" : "English"}
              </button>
            </nav>
          </div>
        </div>
        <Show when={mobileMenuOpen()}>
          <nav id="mobile-topbar-menu" class="mt-3 flex flex-col gap-2 border-t border-gray-800 pt-3 text-sm sm:hidden">
            <A
              href="/collections"
              class="rounded-md px-3 py-2 text-base font-medium text-gray-200 transition-colors hover:bg-gray-800 hover:text-white dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("collectionsNav")}
            </A>
            <A
              href="/faq"
              class="rounded-md px-3 py-2 text-base font-medium text-gray-200 transition-colors hover:bg-gray-800 hover:text-white dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("faqNav")}
            </A>
          </nav>
        </Show>
      </div>
    </header>
  );
}
