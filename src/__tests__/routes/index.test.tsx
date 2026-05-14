// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";

vi.mock("@solidjs/router", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  createAsync: () => () => undefined,
  redirect: () => undefined,
  useNavigate: () => vi.fn(),
}));

vi.mock("~/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const { default: Home } = await import("~/routes/index");

describe("home page site selector", () => {
  it("restores and persists the selected site via cookies", () => {
    document.cookie = "site=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.cookie = "site=atcoder; path=/";

    const firstContainer = document.createElement("div");
    document.body.appendChild(firstContainer);
    const firstDispose = render(() => <Home />, firstContainer);
    try {
      const siteSelect = firstContainer.querySelector<HTMLSelectElement>("#site-select");
      expect(siteSelect?.value).toBe("atcoder");

      if (!siteSelect) throw new Error("site-select not found");
      siteSelect.value = "codeforces";
      siteSelect.dispatchEvent(new Event("change", { bubbles: true }));
    } finally {
      firstDispose();
      firstContainer.remove();
    }

    const secondContainer = document.createElement("div");
    document.body.appendChild(secondContainer);
    const secondDispose = render(() => <Home />, secondContainer);
    try {
      const siteSelect = secondContainer.querySelector<HTMLSelectElement>("#site-select");
      expect(siteSelect?.value).toBe("codeforces");
    } finally {
      secondDispose();
      secondContainer.remove();
      document.cookie = "site=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    }
  });
});
