import type { Metadata } from "next"
import { Suspense } from "react"

import { CatalogClient } from "@/app/catalog/catalog-client"
import { getCategories, getProducts } from "@/lib/catalog"
import { resolveAudienceContext } from "@/lib/audience-context"

type CatalogPageProps = {
  searchParams?: Promise<{
    cat?: string
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
  const categories = await getCategories()
  const audienceContext = await resolveAudienceContext({
    searchParams: resolvedSearchParams,
  })
  const mode = audienceContext?.audience === "b2b" ? "b2b" : "b2c"
  const visibleCategories = categories.filter((category) =>
    mode === "b2b" ? category.showInB2b !== false : category.showInB2c !== false
  )
  const products = await getProducts({
    audience: audienceContext?.audience,
  })
  const productCountByCategoryId = products.reduce((map, product) => {
    map.set(product.categoryId, (map.get(product.categoryId) ?? 0) + 1)
    return map
  }, new Map<string, number>())

  const catalogCategories = visibleCategories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    parentId: category.parentId,
    count: productCountByCategoryId.get(category.id) ?? 0,
  }))

  const catalogProducts = products.map((product) => ({
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
    />
  )
}
