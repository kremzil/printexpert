"use client"

import { LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react"

import type { CustomerMode } from "@/components/print/types"
import { ModeButton } from "@/components/print/mode-button"

export type ViewMode = "grid" | "list"
export type SortOption = "relevance" | "popular" | "price-asc" | "price-desc" | "name"

interface CatalogHeaderProps {
  mode: CustomerMode
  searchQuery: string
  onSearchChange: (value: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  sortBy: SortOption
  onSortChange: (value: SortOption) => void
  totalResults: number
  onToggleFilters?: () => void
}

export function CatalogHeader({
  mode,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  totalResults,
  onToggleFilters,
}: CatalogHeaderProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Nájdené produkty:</span>
          <span className="font-semibold text-foreground">{totalResults}</span>
        </div>

        <ModeButton
          type="button"
          mode={mode}
          variant="outline"
          size="sm"
          onClick={onToggleFilters}
          className="md:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtre
        </ModeButton>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Hľadať produkty..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full rounded-lg border border-border bg-muted/50 py-2 pl-10 pr-4 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              className={`rounded-md px-2 py-1.5 text-sm transition ${
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={`rounded-md px-2 py-1.5 text-sm transition ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value as SortOption)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            style={{ color: modeColor }}
          >
            <option value="relevance">Najrelevantnejšie</option>
            <option value="popular">Najpopulárnejšie</option>
            <option value="price-asc">Cena: od najnižšej</option>
            <option value="price-desc">Cena: od najvyššej</option>
            <option value="name">Názov A–Z</option>
          </select>
        </div>
      </div>
    </div>
  )
}
