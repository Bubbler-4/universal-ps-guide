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
    try {
      const firstContainer = document.createElement("div");
      document.body.appendChild(firstContainer);
      const firstDispose = render(() => <Home />, firstContainer);
      try {
        const siteSelect = firstContainer.querySelector<HTMLSelectElement>("#site-select");
        expect(siteSelect?.value).toBe("atcoder");

        if (!siteSelect) throw new Error("site-select not found");
        siteSelect.value = "codeforces";
        siteSelect.dispatchEvent(new Event("change", { bubbles: true }));
        expect(document.cookie.split("; ").some((entry) => entry.startsWith("site=codeforces"))).toBe(
          true,
        );
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
      }
    } finally {
      document.cookie = "site=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    }
  });

  it("falls back to default when cookie has an unknown site", () => {
    document.cookie = "site=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.cookie = "site=unknown-site; path=/";

    const container = document.createElement("div");
    document.body.appendChild(container);
    const dispose = render(() => <Home />, container);
    try {
      const siteSelect = container.querySelector<HTMLSelectElement>("#site-select");
      if (!siteSelect) throw new Error("site-select not found");
      expect(siteSelect.value).toBe(siteSelect.options[0]?.value);
    } finally {
      dispose();
      container.remove();
      document.cookie = "site=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    }
  });
});
