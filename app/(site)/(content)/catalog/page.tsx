import type { Metadata } from "next"
import { Suspense } from "react"

import { CatalogClient } from "@/app/(site)/(content)/catalog/catalog-client"
import {
  getCategories,
  getCatalogProducts,
  getCategoryProductCounts,
  type CatalogSort,
} from "@/lib/catalog"
import { resolveAudienceContext } from "@/lib/audience-context"

type CatalogPageProps = {
  searchParams?: Promise<{
    cat?: string
    q?: string
    sort?: string
    page?: string
  }>
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://printexpert.sk"

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: {
      canonical: new URL("/catalog", siteUrl),
    },
  }
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  return (
    <Suspense
      fallback={
        <section className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-7 w-1/2 rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
          </div>
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            Načítavame katalóg…
          </div>
        </section>
      }
    >
      <CatalogContent searchParamsPromise={searchParams} />
    </Suspense>
  )
}

async function CatalogContent({
  searchParamsPromise,
}: {
  searchParamsPromise?: CatalogPageProps["searchParams"]
}) {
  const resolvedSearchParams = searchParamsPromise
    ? await searchParamsPromise
    : {}
  const categorySlug = resolvedSearchParams?.cat ?? null
  const searchQuery = resolvedSearchParams?.q ?? ""
  const sortParam = resolvedSearchParams?.sort
  const sortBy: CatalogSort = ["relevance", "popular", "price-asc", "price-desc", "name"].includes(
    sortParam ?? ""
  )
    ? (sortParam as CatalogSort)
    : "relevance"
  const pageParam = resolvedSearchParams?.page
  const parsedPage = pageParam ? Number(pageParam) : Number.NaN
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1
  const pageSize = 24

  const categories = await getCategories()
  const audienceContext = await resolveAudienceContext({
    searchParams: resolvedSearchParams,
  })
  const shouldFilterByAudience = audienceContext.source !== "default"
  const catalogAudience = shouldFilterByAudience ? audienceContext.audience : null
  const mode = audienceContext?.audience === "b2b" ? "b2b" : "b2c"
  const visibleCategories = shouldFilterByAudience
    ? categories.filter((category) =>
        mode === "b2b" ? category.showInB2b !== false : category.showInB2c !== false
      )
    : categories
  const categoryBySlug = new Map(
    visibleCategories.map((category) => [category.slug, category])
  )
  const childrenByParentId = visibleCategories.reduce((map, category) => {
    if (!category.parentId) return map
    const list = map.get(category.parentId) ?? []
    list.push(category)
    map.set(category.parentId, list)
    return map
  }, new Map<string, typeof visibleCategories>())
  const selectedCategory = categorySlug
    ? categoryBySlug.get(categorySlug)
    : null
  const selectedCategoryIds = selectedCategory
    ? [
        selectedCategory.id,
        ...(childrenByParentId.get(selectedCategory.id) ?? []).map((item) => item.id),
      ]
    : null

  const [catalogData, productCountByCategoryId] = await Promise.all([
    getCatalogProducts({
      audience: catalogAudience,
      categoryIds: selectedCategoryIds,
      query: searchQuery,
      sort: sortBy,
      page,
      pageSize,
      includeHidden: Boolean(searchQuery),
    }),
    getCategoryProductCounts({ audience: catalogAudience }),
  ])

  const catalogCategories = visibleCategories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    parentId: category.parentId,
    count: productCountByCategoryId.get(category.id) ?? 0,
  }))

  const catalogProducts = catalogData.products.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    excerpt: product.excerpt,
    description: product.description,
    priceFrom: product.priceFrom,
    images: product.images ?? [],
    categoryId: product.categoryId,
  }))

  return (
    <CatalogClient
      mode={mode}
      categories={catalogCategories}
      products={catalogProducts}
      totalResults={catalogData.total}
      page={catalogData.page}
      pageSize={catalogData.pageSize}
      searchQuery={searchQuery}
      sortBy={sortBy}
      selectedCategory={categorySlug}
    />
  )
}
