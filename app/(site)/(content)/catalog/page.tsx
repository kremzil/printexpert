import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { CatalogClient } from "@/app/(site)/(content)/catalog/catalog-client"
import { CatalogPageSkeleton } from "@/app/(site)/(content)/catalog/catalog-page-skeleton"
import {
  getCategories,
  getCatalogProducts,
  getCategoryProductCounts,
  getTopProductIds,
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

const buildCategoryPath = (
  categorySlug: string,
  searchParams: {
    q?: string
    sort?: string
    page?: string
  }
) => {
  const params = new URLSearchParams()

  if (searchParams.q) {
    params.set("q", searchParams.q)
  }

  if (searchParams.sort) {
    params.set("sort", searchParams.sort)
  }

  if (searchParams.page && searchParams.page !== "1") {
    params.set("page", searchParams.page)
  }

  const query = params.toString()
  const basePath = `/kategorie/${encodeURIComponent(categorySlug)}`
  return query ? `${basePath}?${query}` : basePath
}

export async function generateMetadata({
  searchParams,
}: CatalogPageProps): Promise<Metadata> {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const categorySlug = resolvedSearchParams.cat?.trim()

  return {
    alternates: {
      canonical: categorySlug
        ? `/kategorie/${categorySlug}`
        : "/catalog",
    },
  }
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const categorySlug = resolvedSearchParams.cat?.trim()

  if (categorySlug) {
    redirect(
      buildCategoryPath(categorySlug, {
        q: resolvedSearchParams.q,
        sort: resolvedSearchParams.sort,
        page: resolvedSearchParams.page,
      })
    )
  }

  return (
    <Suspense fallback={<CatalogPageSkeleton />}>
      <CatalogContent searchParamsPromise={Promise.resolve(resolvedSearchParams)} />
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

  const [catalogData, productCountByCategoryId, topProductIds] = await Promise.all([
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
    getTopProductIds(mode),
  ])
  const topProductIdSet = new Set(topProductIds)

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
    priceAfterDiscountFrom: product.priceAfterDiscountFrom,
    images: product.images ?? [],
    categoryId: product.categoryId,
    isTopProduct: topProductIdSet.has(product.id),
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
