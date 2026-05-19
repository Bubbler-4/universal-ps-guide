// @vitest-environment jsdom

import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();

vi.mock("@solidjs/router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("~/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const { ProblemSearchInput } = await import("~/components/ProblemSearchInput");

describe("ProblemSearchInput", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          matches: ["A100"],
          hasExactMatch: false,
        }),
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("navigates when clicking the create row in home mode", async () => {
    const [site] = createSignal("codeforces");
    const [value, setValue] = createSignal("");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const dispose = render(
      () => (
        <ProblemSearchInput
          site={site}
          value={value}
          onInput={setValue}
          mode="home"
        />
      ),
      container,
    );

    try {
      const input = container.querySelector<HTMLInputElement>("input");
      if (!input) throw new Error("search input not found");

      input.value = "a100";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      await vi.advanceTimersByTimeAsync(250);

      const createRow = container.querySelector<HTMLElement>(
        'div[role="button"][aria-label="searchSuggestionCreate A100"]',
      );
      if (!createRow) throw new Error("create row not found");

      createRow.click();

      expect(navigateMock).toHaveBeenCalledWith("/problems/codeforces/A100");
    } finally {
      dispose();
      container.remove();
    }
  });
});
