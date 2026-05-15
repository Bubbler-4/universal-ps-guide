import { createSignal, For, Show } from "solid-js";
import { normalizeProblemId } from "~/lib/problems";
import { useI18n } from "~/lib/i18n";

type SearchResult = {
  matches: string[];
  hasExactMatch: boolean;
};

type ProblemSearchInputProps = {
  site: () => string;
  value: () => string;
  onInput: (value: string) => void;
  placeholder?: string;
  /** Called when a suggestion is clicked to add to collection */
  onAdd?: (problemId: string) => void;
  /** If true, shows "View" links; if false, shows "Add" buttons and "no match" text */
  mode: "home" | "collection";
};

/**
 * A problem ID input with an autocomplete dropdown that shows prefix matches.
 *
 * In "home" mode:
 *  - Each match has a "View" link to the problem page.
 *  - If no exact match, a "Create" row is shown.
 *
 * In "collection" mode:
 *  - Each match has an "Add" button.
 *  - If no matches at all, a "No matching problems" row is shown.
 */
export function ProblemSearchInput(props: ProblemSearchInputProps) {
  const { t } = useI18n();
  const [suggestions, setSuggestions] = createSignal<string[]>([]);
  const [hasExactMatch, setHasExactMatch] = createSignal(false);
  const [showSuggestions, setShowSuggestions] = createSignal(false);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let searchAbortController: AbortController | undefined;

  const fetchSuggestions = (value: string, currentSite: string) => {
    clearTimeout(debounceTimer);
    const normalized = normalizeProblemId(value);
    if (!normalized) {
      setSuggestions([]);
      setHasExactMatch(false);
      setShowSuggestions(false);
      return;
    }
    debounceTimer = setTimeout(async () => {
      // Abort any previous request
      if (searchAbortController) {
        searchAbortController.abort();
      }
      searchAbortController = new AbortController();
      const controller = searchAbortController;

      try {
        const res = await fetch(
          `/api/problems/search?site=${encodeURIComponent(currentSite)}&prefix=${encodeURIComponent(normalized)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const body = (await res.json()) as SearchResult;
          // Only update state if this request wasn't aborted
          if (!controller.signal.aborted) {
            setSuggestions(body.matches ?? []);
            setHasExactMatch(body.hasExactMatch ?? false);
            setShowSuggestions(true);
          }
        } else if (!controller.signal.aborted) {
          setSuggestions([]);
          setHasExactMatch(false);
        }
      } catch (err) {
        // Only clear state if the request wasn't aborted
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setHasExactMatch(false);
        }
      }
    }, 200);
  };

  const normalizedInput = () => normalizeProblemId(props.value());

  const problemHref = (id: string) =>
    `/problems/${props.site().toLowerCase()}/${encodeURIComponent(id)}`;

  return (
    <div class="flex-1 relative">
      <input
        type="text"
        value={props.value()}
        placeholder={props.placeholder}
        onInput={(e) => {
          props.onInput(e.currentTarget.value);
          fetchSuggestions(e.currentTarget.value, props.site());
        }}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        onFocus={() => {
          const currentNormalized = normalizedInput();
          if (currentNormalized) {
            fetchSuggestions(props.value(), props.site());
          } else if (suggestions().length > 0) {
            setShowSuggestions(true);
          }
        }}
        class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      />
      <Show when={showSuggestions() && normalizedInput()}>
        <div class="absolute left-0 right-0 top-full mt-1 z-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <For each={suggestions()}>
            {(id) => (
              <div class="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span class="text-sm text-gray-800 dark:text-gray-200 font-mono">{id}</span>
                <Show
                  when={props.mode === "collection"}
                  fallback={
                    <a
                      href={problemHref(id)}
                      class="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2 shrink-0"
                      onClick={() => setShowSuggestions(false)}
                    >
                      {t("searchSuggestionView")}
                    </a>
                  }
                >
                  <button
                    type="button"
                    class="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2 shrink-0"
                    onClick={() => {
                      setShowSuggestions(false);
                      props.onAdd?.(id);
                    }}
                  >
                    {t("searchSuggestionAdd")}
                  </button>
                </Show>
              </div>
            )}
          </For>
          <Show when={props.mode === "home" && !hasExactMatch()}>
            <div class="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/30">
              <span class="text-sm text-blue-700 dark:text-blue-300">
                {t("searchSuggestionCreateDesc")}:{" "}
                <span class="font-mono">{normalizedInput()}</span>
              </span>
              <a
                href={problemHref(normalizedInput())}
                class="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2 shrink-0"
                onClick={() => setShowSuggestions(false)}
              >
                {t("searchSuggestionCreate")}
              </a>
            </div>
          </Show>
          <Show when={props.mode === "collection" && suggestions().length === 0}>
            <div class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              {t("searchSuggestionNoMatch")}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
