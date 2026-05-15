// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("collection problem row drag handle", () => {
  it("only makes the dedicated handle draggable on the new collection page", async () => {
    vi.resetModules();
    vi.doMock("@solidjs/router", () => ({
      A: (props: { href: string; class?: string; children?: unknown }) => (
        <a href={props.href} class={props.class}>
          {props.children}
        </a>
      ),
      cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
      createAsync: () => () => ({ status: "ok" }),
      redirect: () => undefined,
      useNavigate: () => vi.fn(),
    }));
    vi.doMock("~/lib/i18n", () => ({
      useI18n: () => ({
        t: (key: string) => key,
      }),
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          problem: { id: 1, site: "BOJ", externalProblemId: "1000" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          problem: { id: 2, site: "BOJ", externalProblemId: "1001" },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { default: AddCollectionPage } = await import("~/routes/collections/new");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const dispose = render(() => <AddCollectionPage />, container);

    try {
      const problemIdInput = container.querySelector<HTMLInputElement>('input[placeholder="problemIdPlaceholder"]');
      if (!problemIdInput) throw new Error("problem id input not found");

      problemIdInput.value = "1000";
      problemIdInput.dispatchEvent(new Event("input", { bubbles: true }));

      const addButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "addProblem",
      );
      if (!addButton) throw new Error("add problem button not found");

      addButton.click();
      await flush();
      await flush();
      problemIdInput.value = "1001";
      problemIdInput.dispatchEvent(new Event("input", { bubbles: true }));
      addButton.click();
      await flush();
      await flush();

      const dragHandle = container.querySelector<HTMLButtonElement>('button[aria-label="dragToReorderProblems"]');
      if (!dragHandle) throw new Error("drag handle not found");

      const row = dragHandle.closest("tr");
      expect(row).toBeTruthy();
      expect(row?.getAttribute("draggable")).toBeNull();
      expect(dragHandle.getAttribute("draggable")).toBe("true");
    } finally {
      dispose();
      container.remove();
      vi.unstubAllGlobals();
    }
  });

  it("only makes the dedicated handle draggable on the edit collection page", async () => {
    vi.resetModules();
    vi.doMock("@solidjs/router", () => ({
      cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
      createAsync: () => () => ({
        status: "ok",
        collectionId: 1,
        authorId: 1,
        title: "Sample",
        problems: [
          { id: 1, site: "BOJ", externalProblemId: "1000", shortDescription: "" },
          { id: 2, site: "BOJ", externalProblemId: "1001", shortDescription: "" },
        ],
      }),
      redirect: () => undefined,
      useNavigate: () => vi.fn(),
      useParams: () => ({ id: "1" }),
    }));
    vi.doMock("~/lib/i18n", () => ({
      useI18n: () => ({
        t: (key: string) => key,
      }),
    }));

    const { default: EditCollectionPage } = await import("~/routes/collections/[id]/edit");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const dispose = render(() => <EditCollectionPage />, container);

    try {
      const dragHandle = container.querySelector<HTMLButtonElement>('button[aria-label="dragToReorderProblems"]');
      if (!dragHandle) throw new Error("drag handle not found");

      const row = dragHandle.closest("tr");
      expect(row).toBeTruthy();
      expect(row?.getAttribute("draggable")).toBeNull();
      expect(dragHandle.getAttribute("draggable")).toBe("true");
    } finally {
      dispose();
      container.remove();
    }
  });
});
