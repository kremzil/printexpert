import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { CatalogClient } from "@/app/(site)/(content)/catalog/catalog-client"
import { CatalogPageSkeleton } from "@/app/(site)/(content)/catalog/catalog-page-skeleton"
import {
  getCategories,
  getCatalogProducts,
  getCategoryBySlug,
  getCategoryProductCounts,
  getTopProductIds,
  type CatalogSort,
} from "@/lib/catalog"
import { resolveAudienceContext } from "@/lib/audience-context"
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, toJsonLd } from "@/lib/seo"

type CategoryPageProps = {
  params: Promise<{
    slug: string
  }>
  searchParams?: Promise<{
    q?: string
    sort?: string
    page?: string
  }>
}

const emptyCategorySearchParams: {
  q?: string
  sort?: string
  page?: string
} = {}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  const defaultOgImage = new URL(DEFAULT_OG_IMAGE, SITE_URL).toString()

  if (!category) {
    return {
      title: "Kategória",
      alternates: {
        canonical: `/kategorie/${slug}`,
      },
      openGraph: {
        siteName: SITE_NAME,
        images: [defaultOgImage],
      },
    }
  }

  return {
    title: category.name,
    description:
      category.description ??
      `Produkty v kategórii ${category.name} od ${SITE_NAME}.`,
    alternates: {
      canonical: `/kategorie/${category.slug}`,
    },
    openGraph: {
      title: `${category.name} | ${SITE_NAME}`,
      description:
        category.description ??
        `Prehľad produktov v kategórii ${category.name}.`,
      url: `/kategorie/${category.slug}`,
      siteName: SITE_NAME,
      images: [defaultOgImage],
    },
  }
}

export default function CategoryPage({ params, searchParams }: CategoryPageProps) {
  return (
    <Suspense fallback={<CatalogPageSkeleton />}>
      <CategoryContent paramsPromise={params} searchParamsPromise={searchParams} />
    </Suspense>
  )
}

async function CategoryContent({
  paramsPromise,
  searchParamsPromise,
}: {
  paramsPromise: CategoryPageProps["params"]
  searchParamsPromise?: CategoryPageProps["searchParams"]
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    paramsPromise,
    searchParamsPromise
      ? searchParamsPromise
      : Promise.resolve(emptyCategorySearchParams),
  ])

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
  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c"

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

  const selectedCategory = categoryBySlug.get(slug)
  if (!selectedCategory) {
    notFound()
  }

  const selectedCategoryIds = [
    selectedCategory.id,
    ...(childrenByParentId.get(selectedCategory.id) ?? []).map((item) => item.id),
  ]

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

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Domov",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Kategórie",
        item: `${SITE_URL}/kategorie`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: selectedCategory.name,
        item: `${SITE_URL}/kategorie/${selectedCategory.slug}`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbJsonLd) }}
      />
      <CatalogClient
        mode={mode}
        categories={catalogCategories}
        products={catalogProducts}
        totalResults={catalogData.total}
        page={catalogData.page}
        pageSize={catalogData.pageSize}
        searchQuery={searchQuery}
        sortBy={sortBy}
        selectedCategory={slug}
      />
    </>
  )
}
