import { describe, expect, it } from "vitest";
import { moveItemDown, moveItemUp, reorderItems } from "~/lib/collections";

describe("reorderItems", () => {
  it("moves an item earlier in the list", () => {
    const items = [1, 2, 3, 4];

    expect(reorderItems(items, 2, 0)).toEqual([3, 1, 2, 4]);
    expect(items).toEqual([1, 2, 3, 4]);
  });

  it("moves an item later in the list", () => {
    expect(reorderItems([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
  });

  it("returns the original array for a no-op move", () => {
    const items = [1, 2, 3];

    expect(reorderItems(items, 1, 1)).toBe(items);
  });

  it("returns the original array when indices are out of range", () => {
    const items = [1, 2, 3];

    expect(reorderItems(items, -1, 1)).toBe(items);
    expect(reorderItems(items, 1, 3)).toBe(items);
  });
});

describe("moveItemUp", () => {
  it("moves an item one position earlier", () => {
    expect(moveItemUp([1, 2, 3], 2)).toEqual([1, 3, 2]);
  });

  it("returns the original array for the first item", () => {
    const items = [1, 2, 3];

    expect(moveItemUp(items, 0)).toBe(items);
  });
});

describe("moveItemDown", () => {
  it("moves an item one position later", () => {
    expect(moveItemDown([1, 2, 3], 0)).toEqual([2, 1, 3]);
  });

  it("returns the original array for the last item", () => {
    const items = [1, 2, 3];

    expect(moveItemDown(items, 2)).toBe(items);
  });
});
