// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clickSuggestionRow = async (container: HTMLDivElement, problemId: string) => {
  await wait(250);
  await flush();
  const problemLabel = Array.from(container.querySelectorAll("span")).find(
    (span) => span.textContent?.trim() === problemId,
  );
  const suggestionRow = problemLabel?.closest("div");
  if (!suggestionRow) throw new Error(`suggestion row not found for ${problemId}`);
  suggestionRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await flush();
};
const getProblemIdsInOrder = (container: HTMLDivElement) =>
  Array.from(container.querySelectorAll("tbody tr"))
    .map((row) => row.querySelectorAll("td")[4]?.textContent?.trim() ?? "")
    .filter((value) => value.length > 0);
const waitForDragHandles = async (container: HTMLDivElement, expectedCount: number, timeoutMs = 4000) => {
  const start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    const handles = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-label="dragToReorderProblems"]'),
    );
    if (handles.length >= expectedCount) {
      return handles;
    }
    await flush();
  }
  const handles = Array.from(
    container.querySelectorAll<HTMLButtonElement>('button[aria-label="dragToReorderProblems"]'),
  );
  throw new Error(`drag handles not found: expected ${expectedCount}, found ${handles.length}`);
};

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

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/problems/search?") && url.includes("prefix=1000")) {
        return { ok: true, json: async () => ({ matches: ["1000"], hasExactMatch: true }) };
      }
      if (url.includes("/api/problems/search?") && url.includes("prefix=1001")) {
        return { ok: true, json: async () => ({ matches: ["1001"], hasExactMatch: true }) };
      }
      if (url.includes("/api/problems/") && url.includes("/1000")) {
        return { ok: true, json: async () => ({ problem: { id: 1, site: "BOJ", externalProblemId: "1000" } }) };
      }
      if (url.includes("/api/problems/") && url.includes("/1001")) {
        return { ok: true, json: async () => ({ problem: { id: 2, site: "BOJ", externalProblemId: "1001" } }) };
      }
      throw new Error(`unexpected fetch URL: ${url}`);
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

      await clickSuggestionRow(container, "1000");
      problemIdInput.value = "1001";
      problemIdInput.dispatchEvent(new Event("input", { bubbles: true }));
      await clickSuggestionRow(container, "1001");

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
      expect(row?.getAttribute("draggable")).toBeNull();
      expect(dragHandle.getAttribute("draggable")).toBe("true");
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

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/problems/search?") && url.includes("prefix=1000")) {
        return { ok: true, json: async () => ({ matches: ["1000"], hasExactMatch: true }) };
      }
      if (url.includes("/api/problems/search?") && url.includes("prefix=1001")) {
        return { ok: true, json: async () => ({ matches: ["1001"], hasExactMatch: true }) };
      }
      if (url.includes("/api/problems/") && url.includes("/1000")) {
        return { ok: true, json: async () => ({ problem: { id: 1, site: "BOJ", externalProblemId: "1000" } }) };
      }
      if (url.includes("/api/problems/") && url.includes("/1001")) {
        return { ok: true, json: async () => ({ problem: { id: 2, site: "BOJ", externalProblemId: "1001" } }) };
      }
      throw new Error(`unexpected fetch URL: ${url}`);
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

      await clickSuggestionRow(container, "1000");
      await waitForDragHandles(container, 1);
      problemIdInput.value = "1001";
      problemIdInput.dispatchEvent(new Event("input", { bubbles: true }));
      await clickSuggestionRow(container, "1001");

      const dragHandles = await waitForDragHandles(container, 2);

      expect(getProblemIdsInOrder(container)).toEqual(["1000", "1001"]);

      const setDragImage = vi.fn();
      const dataTransfer = {
        setData: vi.fn(),
        setDragImage,
        effectAllowed: "",
      };

      const dragStartEvent = new Event("dragstart", { bubbles: true }) as Event & {
        dataTransfer?: typeof dataTransfer;
        clientX?: number;
        clientY?: number;
      };
      dragStartEvent.dataTransfer = dataTransfer;
      dragStartEvent.clientX = 0;
      dragStartEvent.clientY = 0;
      dragHandles[0]!.dispatchEvent(dragStartEvent);

      const secondRow = dragHandles[1]!.closest("tr");
      if (!secondRow) throw new Error("second row not found");

      const dragEnterEvent = new Event("dragenter", { bubbles: true }) as Event & {
        dataTransfer?: typeof dataTransfer;
      };
      dragEnterEvent.dataTransfer = dataTransfer;
      secondRow.dispatchEvent(dragEnterEvent);
      await flush();

      expect(setDragImage).toHaveBeenCalled();
      expect(getProblemIdsInOrder(container)).toEqual(["1001", "1000"]);

      const dropEvent = new Event("drop", { bubbles: true }) as Event & {
        dataTransfer?: typeof dataTransfer;
      };
      dropEvent.dataTransfer = dataTransfer;
      secondRow.dispatchEvent(dropEvent);
      await flush();

      expect(getProblemIdsInOrder(container)).toEqual(["1001", "1000"]);
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

      const setDragImage = vi.fn();
      const dataTransfer = {
        setData: vi.fn(),
        setDragImage,
        effectAllowed: "",
      };

      const dragStartEvent = new Event("dragstart", { bubbles: true }) as Event & {
        dataTransfer?: typeof dataTransfer;
        clientX?: number;
        clientY?: number;
      };
      dragStartEvent.dataTransfer = dataTransfer;
      dragStartEvent.clientX = 0;
      dragStartEvent.clientY = 0;
      dragHandles[0]!.dispatchEvent(dragStartEvent);
      expect(setDragImage).toHaveBeenCalledWith(dragHandles[0]!.closest("tr"), 0, 0);

      const secondRow = dragHandles[1]!.closest("tr");
      if (!secondRow) throw new Error("second row not found");

      const dragEnterEvent = new Event("dragenter", { bubbles: true }) as Event & {
        dataTransfer?: typeof dataTransfer;
      };
      dragEnterEvent.dataTransfer = dataTransfer;
      secondRow.dispatchEvent(dragEnterEvent);
      await flush();

      expect(getProblemIdsInOrder(container)).toEqual(["1001", "1000"]);

      const dropEvent = new Event("drop", { bubbles: true }) as Event & {
        dataTransfer?: typeof dataTransfer;
      };
      dropEvent.dataTransfer = dataTransfer;
      secondRow.dispatchEvent(dropEvent);
      await flush();

      expect(getProblemIdsInOrder(container)).toEqual(["1001", "1000"]);
    } finally {
      dispose();
      container.remove();
    }
  });
});
