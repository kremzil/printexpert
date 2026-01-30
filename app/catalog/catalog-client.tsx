"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  images?: Array<{ url: string; alt?: string | null }>
  categoryId: string
}

type CatalogClientProps = {
  mode: CustomerMode
  categories: CategoryItem[]
  products: CatalogProduct[]
}

export function CatalogClient({ mode, categories, products }: CatalogClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedCategorySlug = searchParams.get("cat")

  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [sortBy, setSortBy] = useState<SortOption>("relevance")
  const [showMobileCategories, setShowMobileCategories] = useState(false)

  const categoryBySlug = useMemo(
    () => new Map(categories.map((category) => [category.slug, category])),
    [categories]
  )
  const childrenByParentId = useMemo(
    () =>
      categories.reduce((map, category) => {
        if (!category.parentId) return map
        const list = map.get(category.parentId) ?? []
        list.push(category)
        map.set(category.parentId, list)
        return map
      }, new Map<string, CategoryItem[]>()),
    [categories]
  )

  const selectedCategory = selectedCategorySlug
    ? categoryBySlug.get(selectedCategorySlug)
    : null
  const selectedCategoryIds = selectedCategory
    ? [
        selectedCategory.id,
        ...(childrenByParentId.get(selectedCategory.id) ?? []).map((item) => item.id),
      ]
    : null

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return products.filter((product) => {
      if (selectedCategoryIds && !selectedCategoryIds.includes(product.categoryId)) {
        return false
      }
      if (query) {
        const haystack = `${product.name} ${product.excerpt ?? ""} ${product.description ?? ""}`.toLowerCase()
        if (!haystack.includes(query)) {
          return false
        }
      }
      return true
    })
  }, [products, searchQuery, selectedCategoryIds])

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts]
    const priceValue = (value?: string | null) => {
      const parsed = value ? Number(value) : Number.NaN
      return Number.isFinite(parsed) ? parsed : null
    }

    return list.sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name)
      }
      if (sortBy === "price-asc" || sortBy === "price-desc") {
        const priceA = priceValue(a.priceFrom)
        const priceB = priceValue(b.priceFrom)
        if (priceA === null && priceB === null) return 0
        if (priceA === null) return 1
        if (priceB === null) return -1
        return sortBy === "price-asc" ? priceA - priceB : priceB - priceA
      }
      if (sortBy === "popular") {
        return 0
      }
      return 0
    })
  }, [filteredProducts, sortBy])

  const activeCategoryLabel = selectedCategory
    ? selectedCategory.name
    : "Katalóg produktov"

  const handleCategorySelect = (slug: string | null) => {
    setShowMobileCategories(false)
    if (!slug) {
      router.push("/catalog")
      return
    }
    router.push(`/catalog?cat=${slug}`)
  }

  return (
    <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2">
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6">
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
            onViewModeChange={setViewMode}
            sortBy={sortBy}
            onSortChange={setSortBy}
            totalResults={sortedProducts.length}
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
                  selectedCategory={selectedCategorySlug}
                  onCategorySelect={handleCategorySelect}
                />
              </div>
            </div>

            <div className="lg:col-span-3">
              {sortedProducts.length === 0 ? (
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
                      handleCategorySelect(null)
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
                      {sortedProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          mode={mode}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedProducts.map((product) => (
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
