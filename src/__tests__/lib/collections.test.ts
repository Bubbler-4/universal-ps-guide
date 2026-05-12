import { describe, expect, it } from "vitest";
import { reorderItems } from "~/lib/collections";

describe("reorderItems", () => {
  it("moves an item earlier in the list", () => {
    expect(reorderItems([1, 2, 3, 4], 2, 0)).toEqual([3, 1, 2, 4]);
  });

  it("moves an item later in the list", () => {
    expect(reorderItems([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
  });

  it("returns the original array for a no-op move", () => {
    const items = [1, 2, 3];

    expect(reorderItems(items, 1, 1)).toBe(items);
  });
});
