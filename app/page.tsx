import { Suspense } from "react"

import { resolveAudienceContext } from "@/lib/audience-context"
import { ModeSelectionPage } from "@/components/print/mode-selection-page"
import { Homepage } from "@/components/print/homepage"
import { getCategories, getProducts } from "@/lib/catalog"

type HomePageProps = {
  searchParams?: Promise<{
    mode?: string
  }>
}

async function HomeContent({
  searchParamsPromise,
}: {
  searchParamsPromise?: HomePageProps["searchParams"]
}) {
  const resolvedSearchParams = searchParamsPromise
    ? await searchParamsPromise
    : {}
  const audienceContext = await resolveAudienceContext({
    searchParams: resolvedSearchParams,
  })
  const isFirstVisit = audienceContext.source === "default"
  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c"

  if (isFirstVisit) {
    return <ModeSelectionPage />
  }

  const [categories, products, topProducts] = await Promise.all([
    getCategories(),
    getProducts({ audience: mode }),
    fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/top-products?audience=${mode}&count=8`,
      { next: { revalidate: 60 } }
    )
      .then(async (res) => (res.ok ? res.json() : []))
      .catch(() => []),
  ])

  const visibleCategories = categories.filter((category) =>
    mode === "b2b" ? category.showInB2b !== false : category.showInB2c !== false
  )
  const categorySlugById = new Map(
    visibleCategories.map((category) => [category.id, category.slug])
  )
  const productCountByCategory = products.reduce((map, product) => {
    const categorySlug = categorySlugById.get(product.categoryId)
    if (!categorySlug) return map
    map.set(categorySlug, (map.get(categorySlug) ?? 0) + 1)
    return map
  }, new Map<string, number>())

  const homepageCategories = visibleCategories
    .filter((category) => !category.parentId)
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      image: category.image,
      productCount: productCountByCategory.get(category.slug) ?? 0,
    }))

  const featuredProducts =
    Array.isArray(topProducts) && topProducts.length > 0
      ? topProducts.map((product: typeof products[number]) => ({
          id: product.id,
          slug: product.slug,
          name: product.name,
          excerpt: product.excerpt,
          description: product.description,
          priceFrom: product.priceFrom ? String(product.priceFrom) : null,
          images: product.images ?? [],
        }))
      : products.slice(0, 8).map((product) => ({
          id: product.id,
          slug: product.slug,
          name: product.name,
          excerpt: product.excerpt,
          description: product.description,
          priceFrom: product.priceFrom,
          images: product.images ?? [],
        }))

  return (
    <Homepage
      mode={mode}
      categories={homepageCategories}
      featuredProducts={featuredProducts}
    />
  )
}

export default function Page({ searchParams }: HomePageProps) {
  return (
    <Suspense
      fallback={
        <section className="space-y-3">
          <div className="h-6 w-40 rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </section>
      }
    >
      <HomeContent searchParamsPromise={searchParams} />
    </Suspense>
  )
}
