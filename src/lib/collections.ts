export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const reordered = [...items];
  const [movedItem] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, movedItem!);
  return reordered;
}

export function moveItemUp<T>(items: T[], index: number): T[] {
  return reorderItems(items, index, index - 1);
}

export function moveItemDown<T>(items: T[], index: number): T[] {
  return reorderItems(items, index, index + 1);
}

export function updateItemById<T extends { id: number }>(
  items: T[],
  id: number,
  update: (item: T) => void
): T[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) {
    return items;
  }

  const updated = [...items];
  update(updated[index]!);
  return updated;
}
