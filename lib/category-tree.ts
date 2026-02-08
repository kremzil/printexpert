type CategoryNode = {
  id: string
  parentId?: string | null
}

const ROOT_KEY = "root"

export function buildCategoryTree<T extends CategoryNode>(categories: T[]) {
  const childrenByParentId = categories.reduce((map, category) => {
    const key = category.parentId ?? ROOT_KEY
    const list = map.get(key) ?? []
    list.push(category)
    map.set(key, list)
    return map
  }, new Map<string, T[]>())

  return {
    childrenByParentId,
    rootCategories: childrenByParentId.get(ROOT_KEY) ?? [],
  }
}
