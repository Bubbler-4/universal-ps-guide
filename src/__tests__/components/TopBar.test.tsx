// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; class?: string; children?: unknown; onClick?: () => void }) => (
    <a href={props.href} class={props.class} onClick={props.onClick}>
      {props.children}
    </a>
  ),
}));

vi.mock("~/lib/i18n", () => ({
  useI18n: () => ({
    lang: () => "en" as const,
    toggleLang: () => undefined,
    t: (key: string) =>
      (
        {
          collectionsNav: "Collections",
          faqNav: "FAQ",
          login: "Login",
          showMenu: "Menu",
          hideMenu: "Close",
          switchToKorean: "Switch to Korean",
          switchToEnglish: "Switch to English",
        } as Record<string, string>
      )[key] ?? key,
  }),
}));

const { default: TopBar } = await import("~/components/TopBar");

describe("TopBar", () => {
  it("toggles the small-screen navigation links", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const dispose = render(() => <TopBar session={null} />, container);
    try {
      const mobileMenuButton = container.querySelector<HTMLButtonElement>('button[aria-controls="mobile-topbar-menu"]');
      const homeLink = container.querySelector<HTMLAnchorElement>('a[href="/"]');

      expect(mobileMenuButton).toBeTruthy();
      expect(homeLink).toBeTruthy();
      expect(mobileMenuButton?.compareDocumentPosition(homeLink as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(mobileMenuButton?.getAttribute("aria-label")).toBe("Menu");
      expect(mobileMenuButton?.textContent?.trim()).toBe("");
      expect(mobileMenuButton?.getAttribute("aria-expanded")).toBe("false");
      expect(container.querySelector("#mobile-topbar-menu")).toBeNull();

      mobileMenuButton?.click();
      expect(mobileMenuButton?.getAttribute("aria-label")).toBe("Close");
      expect(mobileMenuButton?.getAttribute("aria-expanded")).toBe("true");

      const mobileMenu = container.querySelector("#mobile-topbar-menu");

      expect(mobileMenu?.textContent).toContain("Collections");
      expect(mobileMenu?.textContent).toContain("FAQ");

      mobileMenuButton?.click();
      expect(mobileMenuButton?.getAttribute("aria-expanded")).toBe("false");
      expect(container.querySelector("#mobile-topbar-menu")).toBeNull();
    } finally {
      dispose();
      container.remove();
    }
  });
});
