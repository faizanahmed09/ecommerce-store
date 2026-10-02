type CategoryVisibilityRow = {
  id: string;
  parent_id: string | null;
  is_enabled: boolean;
};

/** Hide disabled categories and children of disabled or missing parents. */
export function visibleCategories<T extends CategoryVisibilityRow>(categories: T[]): T[] {
  const byId = new Map(categories.map((category) => [category.id, category]));

  return categories.filter((category) => {
    let current: T | undefined = category;
    const visited = new Set<string>();

    while (current) {
      if (!current.is_enabled || visited.has(current.id)) {
        return false;
      }

      visited.add(current.id);
      if (!current.parent_id) {
        return true;
      }

      current = byId.get(current.parent_id);
    }

    return false;
  });
}
