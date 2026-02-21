"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronRight, Home, Package } from "lucide-react"

import { CatalogHeader, type SortOption, type ViewMode } from "@/components/print/catalog-header"
import { CategorySidebar } from "@/components/print/category-sidebar"
import { ProductListItem } from "@/components/print/product-list-item"
import ProductCard from "@/components/product/product-card"
import type { CustomerMode } from "@/components/print/types"

type CategoryItem = {
  id: string
  slug: string
  name: string
  count: number
  parentId?: string | null
}

type CatalogProduct = {
  id: string
  slug: string
  name: string
  excerpt?: string | null
  description?: string | null
  priceFrom?: string | null
  priceAfterDiscountFrom?: string | null
  images?: Array<{ url: string; alt?: string | null }>
  categoryId: string
  isTopProduct?: boolean
}

type CatalogClientProps = {
  mode: CustomerMode
  categories: CategoryItem[]
  products: CatalogProduct[]
  totalResults: number
  page: number
  pageSize: number
  searchQuery: string
  sortBy: SortOption
  selectedCategory: string | null
}

export function CatalogClient({
  mode,
  categories,
  products,
  totalResults,
  page,
  pageSize,
  searchQuery: initialSearchQuery,
  sortBy: initialSortBy,
  selectedCategory,
}: CatalogClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get("view") as ViewMode) || "grid"
  )
  const [sortBy, setSortBy] = useState<SortOption>(initialSortBy)
  const [showMobileCategories, setShowMobileCategories] = useState(false)

  const categoryBySlug = useMemo(
    () => new Map(categories.map((category) => [category.slug, category])),
    [categories]
  )
  const activeCategoryLabel = selectedCategory
    ? categoryBySlug.get(selectedCategory)?.name ?? "Katalóg produktov"
    : "Katalóg produktov"

  useEffect(() => {
    setSearchQuery(initialSearchQuery)
  }, [initialSearchQuery])

  useEffect(() => {
    setSortBy(initialSortBy)
  }, [initialSortBy])

  useEffect(() => {
    const viewParam = (searchParams.get("view") as ViewMode) || "grid"
    setViewMode(viewParam)
  }, [searchParams])

  const buildSearchParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(next).forEach(([key, value]) => {
        if (!value) {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      })
      const query = params.toString()
      return query ? `${pathname}?${query}` : pathname
    },
    [pathname, searchParams]
  )

  const replaceSearchParams = useCallback(
    (next: Record<string, string | null>) => {
      router.replace(buildSearchParams(next))
    },
    [buildSearchParams, router]
  )

  const pushSearchParams = useCallback(
    (next: Record<string, string | null>) => {
      router.push(buildSearchParams(next))
    },
    [buildSearchParams, router]
  )

  const buildCategoryHref = useCallback(
    (slug: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("cat")
      params.delete("mode")
      params.delete("page")
      const query = params.toString()
      const basePath = slug ? `/kategorie/${slug}` : "/catalog"
      return query ? `${basePath}?${query}` : basePath
    },
    [searchParams]
  )

  useEffect(() => {
    const handle = setTimeout(() => {
      const current = searchParams.get("q") ?? ""
      if (searchQuery === current) return
      replaceSearchParams({
        q: searchQuery.trim() || null,
        page: null,
      })
    }, 350)
    return () => clearTimeout(handle)
  }, [searchQuery, replaceSearchParams, searchParams])

  const handleCategorySelect = (slug: string | null) => {
    setShowMobileCategories(false)
    router.push(buildCategoryHref(slug))
  }

  const handleSortChange = (value: SortOption) => {
    setSortBy(value)
    pushSearchParams({
      sort: value === "relevance" ? null : value,
      page: null,
    })
  }

  const handleViewModeChange = (value: ViewMode) => {
    setViewMode(value)
    replaceSearchParams({
      view: value === "grid" ? null : value,
    })
  }

  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize))

  return (
    <div className="w-full">
      <div className="min-h-screen bg-background rounded-2xl shadow-2xl my-4 md:my-8">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
          <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Home className="h-4 w-4" />
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">{activeCategoryLabel}</span>
          </nav>

          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold md:text-4xl">Katalóg produktov</h1>
            <p className="text-lg text-muted-foreground">
              {mode === "b2c"
                ? "Objavte širokú ponuku tlačových produktov s expresným dodaním"
                : "Profesionálne tlačové riešenia pre váš biznis s objemovými zľavami"}
            </p>
          </div>

          <CatalogHeader
            mode={mode}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            totalResults={totalResults}
            onToggleFilters={() => setShowMobileCategories((prev) => !prev)}
          />

          <div className="grid gap-8 lg:grid-cols-4">
            <div className={`lg:col-span-1 ${showMobileCategories ? "block" : "hidden lg:block"}`}>
              <div className="sticky top-24">
                {showMobileCategories ? (
                  <button
                    type="button"
                    onClick={() => setShowMobileCategories(false)}
                    className="mb-4 flex w-full items-center justify-between rounded-lg border border-border bg-card p-4 text-sm font-semibold lg:hidden"
                  >
                    Zavrieť kategórie
                    <span>×</span>
                  </button>
                ) : null}

                <CategorySidebar
                  mode={mode}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onCategorySelect={handleCategorySelect}
                />
              </div>
            </div>

            <div className="lg:col-span-3">
              {products.length === 0 ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-12 text-center">
                  <Package className="mb-4 h-16 w-16 text-muted-foreground" />
                  <h3 className="mb-2 text-xl font-bold">Žiadne produkty</h3>
                  <p className="mb-6 text-muted-foreground">
                    Nenašli sme žiadne produkty podľa vašich kritérií
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("")
                      router.push("/catalog")
                    }}
                    className="rounded-lg border-2 border-border px-6 py-2 font-semibold transition-all hover:bg-muted"
                  >
                    Zobraziť všetko
                  </button>
                </div>
              ) : (
                <>
                  {viewMode === "grid" ? (
                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                      {products.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          mode={mode}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {products.map((product) => (
                        <ProductListItem
                          key={product.id}
                          mode={mode}
                          href={`/product/${product.slug}`}
                          title={product.name}
                          description={product.excerpt ?? product.description}
                          image={product.images?.[0]?.url ?? null}
                          priceFrom={product.priceFrom ?? null}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      pushSearchParams({
                        page: String(Math.max(1, page - 1)),
                      })
                    }
                    disabled={page <= 1}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Späť
                  </button>
                  <div className="text-sm text-muted-foreground">
                    Strana {page} z {totalPages}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      pushSearchParams({
                        page: String(Math.min(totalPages, page + 1)),
                      })
                    }
                    disabled={page >= totalPages}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Ďalej
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Bestsellery",
                description: "Najpredávanejšie produkty tohto mesiaca",
                accent: "text-blue-600",
                bg: "from-blue-50 to-blue-100",
              },
              {
                title: "Prémiová kvalita",
                description: "Luxusné produkty s ručným spracovaním",
                accent: "text-purple-600",
                bg: "from-purple-50 to-purple-100",
              },
              {
                title: "Nové produkty",
                description: "Najnovšie pridané do našej ponuky",
                accent: "text-orange-600",
                bg: "from-orange-50 to-orange-100",
              },
            ].map((card) => (
              <div
                key={card.title}
                className={`rounded-2xl border border-border bg-gradient-to-br ${card.bg} p-6 text-center`}
              >
                <h3 className="mb-2 font-bold">{card.title}</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  {card.description}
                </p>
                <span className={`text-sm font-medium ${card.accent}`}>
                  Zobraziť viac →
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
