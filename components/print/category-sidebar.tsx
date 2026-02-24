"use client"

import { useState } from "react"
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

  const rootCategories = categories.filter((category) => !category.parentId)
  const childrenByParent = categories.reduce((map, category) => {
    if (!category.parentId) return map
    const list = map.get(category.parentId) ?? []
    list.push(category)
    map.set(category.parentId, list)
    return map
  }, new Map<string, CategoryItem[]>())
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({})
  const selectedParentId =
    categories.find((category) => category.slug === selectedCategory)?.parentId ?? null

  const toggleCategoryChildren = (categoryId: string) => {
    setExpandedOverrides((prev) => {
      const isExpanded = prev[categoryId] ?? selectedParentId === categoryId
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
        {rootCategories.map((category) => {
          const Icon = iconBySlug[category.slug] ?? FileText
          const children = childrenByParent.get(category.id) ?? []
          const categoryCount = children.length
            ? children.reduce((sum, child) => sum + child.count, 0)
            : category.count
          const isExpanded =
            expandedOverrides[category.id] ?? selectedParentId === category.id
          const isActive =
            selectedCategory === category.slug ||
            children.some((child) => child.slug === selectedCategory)

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
                  onClick={() => onCategorySelect(category.slug)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
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
                  <span className="truncate">{category.name}</span>
                </button>

                {children.length > 0 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleCategoryChildren(category.id)
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
                )}
                <span
                  className={`ml-2 text-xs ${
                    isActive ? "text-white/80" : "text-muted-foreground"
                  }`}
                >
                  {categoryCount}
                </span>
              </div>

              {children.length > 0 && isExpanded && (
                <div className="ml-6 space-y-2 border-l border-border pl-3">
                  {children.map((child) => {
                    const childActive = selectedCategory === child.slug
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onCategorySelect(child.slug)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                          childActive
                            ? "bg-muted font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <span>{child.name}</span>
                        <span
                          className={`text-xs ${
                            childActive ? "text-foreground/60" : "text-muted-foreground"
                          }`}
                        >
                          {child.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
