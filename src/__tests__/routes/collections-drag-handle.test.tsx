// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const getProblemIdsInOrder = (container: HTMLDivElement) =>
  Array.from(container.querySelectorAll("tbody tr"))
    .map((row) => row.querySelectorAll("td")[4]?.textContent?.trim() ?? "")
    .filter((value) => value.length > 0);

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
      // The row itself must not be draggable; dragging is initiated only via the handle
      expect(row?.getAttribute("draggable")).toBeNull();
      // Pressing the handle must immediately mark the row as dragging (opacity-50)
      dragHandle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, isPrimary: true, button: 0 }));
      await flush();
      expect(row?.classList.contains("opacity-50")).toBe(true);
      dragHandle.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, isPrimary: true }));
      await flush();
      expect(row?.classList.contains("opacity-50")).toBe(false);
    } finally {
      dispose();
      container.remove();
      vi.unstubAllGlobals();
    }
  });

  it("only makes the dedicated handle draggable on the edit collection page", async () => {
    vi.resetModules();
    vi.doMock("@solidjs/router", () => ({
      A: (props: { href: string; class?: string; children?: unknown }) => (
        <a href={props.href} class={props.class}>
          {props.children}
        </a>
      ),
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
      // The row itself must not be draggable; dragging is initiated only via the handle
      expect(row?.getAttribute("draggable")).toBeNull();
      // Pressing the handle must immediately mark the row as dragging (opacity-50)
      dragHandle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, isPrimary: true, button: 0 }));
      await flush();
      expect(row?.classList.contains("opacity-50")).toBe(true);
      dragHandle.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, isPrimary: true }));
      await flush();
      expect(row?.classList.contains("opacity-50")).toBe(false);
    } finally {
      dispose();
      container.remove();
    }
  });

  it("reorders rows while dragging over another row on the new collection page", async () => {
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

      const dragHandles = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[aria-label="dragToReorderProblems"]'),
      );
      if (dragHandles.length < 2) throw new Error("drag handles not found");

      expect(getProblemIdsInOrder(container)).toEqual(["1000", "1001"]);

      const secondRow = dragHandles[1]!.closest("tr");
      if (!secondRow) throw new Error("second row not found");

      const originalElementFromPoint = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
      Object.defineProperty(document, "elementFromPoint", {
        value: () => secondRow,
        writable: true,
        configurable: true,
      });
      try {
        dragHandles[0]!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, isPrimary: true, button: 0, buttons: 1 }));
        dragHandles[0]!.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, isPrimary: true, buttons: 1, clientX: 10, clientY: 50 }));
        await flush();

        expect(getProblemIdsInOrder(container)).toEqual(["1001", "1000"]);

        dragHandles[0]!.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, isPrimary: true }));
      } finally {
        if (originalElementFromPoint) {
          Object.defineProperty(document, "elementFromPoint", originalElementFromPoint);
        } else {
          // elementFromPoint was on the prototype; remove our own-property override
          delete (document as Record<string, unknown>)["elementFromPoint"];
        }
      }
    } finally {
      dispose();
      container.remove();
      vi.unstubAllGlobals();
    }
  });

  it("reorders rows while dragging over another row on the edit collection page", async () => {
    vi.resetModules();
    vi.doMock("@solidjs/router", () => ({
      A: (props: { href: string; class?: string; children?: unknown }) => (
        <a href={props.href} class={props.class}>
          {props.children}
        </a>
      ),
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
      const dragHandles = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[aria-label="dragToReorderProblems"]'),
      );
      if (dragHandles.length < 2) throw new Error("drag handles not found");

      expect(getProblemIdsInOrder(container)).toEqual(["1000", "1001"]);

      const secondRow = dragHandles[1]!.closest("tr");
      if (!secondRow) throw new Error("second row not found");

      const originalElementFromPoint = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
      Object.defineProperty(document, "elementFromPoint", {
        value: () => secondRow,
        writable: true,
        configurable: true,
      });
      try {
        dragHandles[0]!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, isPrimary: true, button: 0, buttons: 1 }));
        dragHandles[0]!.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, isPrimary: true, buttons: 1, clientX: 10, clientY: 50 }));
        await flush();

        expect(getProblemIdsInOrder(container)).toEqual(["1001", "1000"]);

        dragHandles[0]!.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, isPrimary: true }));
      } finally {
        if (originalElementFromPoint) {
          Object.defineProperty(document, "elementFromPoint", originalElementFromPoint);
        } else {
          delete (document as Record<string, unknown>)["elementFromPoint"];
        }
      }
    } finally {
      dispose();
      container.remove();
    }
  });
});
