"use client"

import { useMemo, useState } from "react"
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  Flag,
  Image as ImageIcon,
  Package,
  Scroll,
} from "lucide-react"

import type { CustomerMode } from "@/components/print/types"
import { buildCategoryTree } from "@/lib/category-tree"

type CategoryItem = {
  id: string
  slug: string
  name: string
  count: number
  parentId?: string | null
}

interface CategorySidebarProps {
  mode: CustomerMode
  categories: CategoryItem[]
  selectedCategory: string | null
  onCategorySelect: (slug: string | null) => void
}

const iconBySlug: Record<string, typeof CreditCard> = {
  vizitky: CreditCard,
  "vizitky-premium": CreditCard,
  letaky: FileText,
  postery: ImageIcon,
  plagaty: ImageIcon,
  brozury: BookOpen,
  katalogy: BookOpen,
  obaly: Package,
  bannery: Flag,
  nalepky: Scroll,
}

export function CategorySidebar({
  mode,
  categories,
  selectedCategory,
  onCategorySelect,
}: CategorySidebarProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  const { childrenByParentId, rootCategories } = useMemo(
    () => buildCategoryTree(categories),
    [categories]
  )
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )
  const parentById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.parentId ?? null])),
    [categories]
  )
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({})
  const selectedCategoryNode =
    categories.find((category) => category.slug === selectedCategory) ?? null

  const selectedAncestorIds = useMemo(() => {
    const ids = new Set<string>()
    if (!selectedCategoryNode) return ids
    let currentParent = selectedCategoryNode.parentId ?? null
    while (currentParent && !ids.has(currentParent)) {
      ids.add(currentParent)
      currentParent = parentById.get(currentParent) ?? null
    }
    return ids
  }, [parentById, selectedCategoryNode])

  const subtreeCountById = useMemo(() => {
    const memo = new Map<string, number>()
    const visit = (id: string, seen: Set<string>) => {
      const cached = memo.get(id)
      if (typeof cached === "number") return cached
      if (seen.has(id)) return 0
      const category = categoryById.get(id)
      if (!category) return 0

      const nextSeen = new Set(seen)
      nextSeen.add(id)

      let total = category.count
      const children = childrenByParentId.get(id) ?? []
      for (const child of children) {
        total += visit(child.id, nextSeen)
      }
      memo.set(id, total)
      return total
    }

    for (const category of categories) {
      visit(category.id, new Set<string>())
    }
    return memo
  }, [categories, categoryById, childrenByParentId])

  const rootItems = rootCategories.length > 0 ? rootCategories : categories

  const toggleCategoryChildren = (categoryId: string) => {
    setExpandedOverrides((prev) => {
      const isExpanded = prev[categoryId] ?? selectedAncestorIds.has(categoryId)
      return {
        ...prev,
        [categoryId]: !isExpanded,
      }
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Kategórie</h3>
        <span className="text-xs text-muted-foreground">
          {categories.length} spolu
        </span>
      </div>

      <button
        type="button"
        onClick={() => onCategorySelect(null)}
        className={`mb-4 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
          !selectedCategory
            ? "border-transparent text-white shadow-sm"
            : "border-border bg-background text-foreground hover:bg-muted/50"
        }`}
        style={!selectedCategory ? { backgroundColor: modeColor } : undefined}
      >
        Všetky produkty
        <span
          className={`text-xs ${
            !selectedCategory ? "text-white/80" : "text-muted-foreground"
          }`}
        >
          {categories.reduce((sum, item) => sum + item.count, 0)}
        </span>
      </button>

      <div className="space-y-2">
        {rootItems.map((category) => {
          const Icon = iconBySlug[category.slug] ?? FileText
          return renderCategoryNode({
            category,
            depth: 0,
            lineage: [],
            selectedCategory,
            selectedAncestorIds,
            childrenByParentId,
            subtreeCountById,
            expandedOverrides,
            modeColor,
            modeAccent,
            Icon,
            onToggle: toggleCategoryChildren,
            onSelect: onCategorySelect,
          })
        })}
      </div>
    </div>
  )
}

function renderCategoryNode({
  category,
  depth,
  lineage,
  selectedCategory,
  selectedAncestorIds,
  childrenByParentId,
  subtreeCountById,
  expandedOverrides,
  modeColor,
  modeAccent,
  Icon,
  onToggle,
  onSelect,
}: {
  category: CategoryItem
  depth: number
  lineage: string[]
  selectedCategory: string | null
  selectedAncestorIds: Set<string>
  childrenByParentId: Map<string, CategoryItem[]>
  subtreeCountById: Map<string, number>
  expandedOverrides: Record<string, boolean>
  modeColor: string
  modeAccent: string
  Icon: typeof CreditCard
  onToggle: (categoryId: string) => void
  onSelect: (slug: string | null) => void
}) {
  const lineageSet = new Set(lineage)
  const children = (childrenByParentId.get(category.id) ?? []).filter(
    (child) => !lineageSet.has(child.id)
  )
  const hasChildren = children.length > 0
  const isExpanded = expandedOverrides[category.id] ?? selectedAncestorIds.has(category.id)
  const isActive = selectedCategory === category.slug || selectedAncestorIds.has(category.id)
  const categoryCount = subtreeCountById.get(category.id) ?? category.count

  return (
    <div key={category.id} className="space-y-2">
      <div
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
          isActive
            ? "border-transparent text-white shadow-sm"
            : "border-border bg-background text-foreground hover:bg-muted/50"
        }`}
        style={isActive ? { backgroundColor: modeColor } : undefined}
      >
        <button
          type="button"
          onClick={() => onSelect(category.slug)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {depth === 0 ? (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{
                backgroundColor: isActive ? "rgba(255,255,255,0.2)" : modeAccent,
              }}
            >
              <Icon
                className="h-4 w-4"
                style={{ color: isActive ? "white" : modeColor }}
              />
            </span>
          ) : (
            <span
              className={`ml-1 text-xs ${
                isActive ? "text-white/80" : "text-muted-foreground"
              }`}
            >
              ↳
            </span>
          )}
          <span className="truncate">{category.name}</span>
        </button>

        {hasChildren ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggle(category.id)
            }}
            className={`ml-2 inline-flex h-6 w-6 items-center justify-center rounded transition ${
              isActive ? "hover:bg-white/20" : "hover:bg-muted"
            }`}
            aria-label={isExpanded ? "Zbaliť podkategórie" : "Rozbaliť podkategórie"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : null}
        <span
          className={`ml-2 text-xs ${
            isActive ? "text-white/80" : "text-muted-foreground"
          }`}
        >
          {categoryCount}
        </span>
      </div>

      {hasChildren && isExpanded ? (
        <div className="ml-5 space-y-2 border-l border-border pl-3">
          {children.map((child) =>
            renderCategoryNode({
              category: child,
              depth: depth + 1,
              lineage: [...lineage, category.id],
              selectedCategory,
              selectedAncestorIds,
              childrenByParentId,
              subtreeCountById,
              expandedOverrides,
              modeColor,
              modeAccent,
              Icon,
              onToggle,
              onSelect,
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
