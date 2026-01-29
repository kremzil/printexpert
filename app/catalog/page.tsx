import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CatalogSidebar } from "@/components/catalog/catalog-sidebar"
import ProductCard from "@/components/product/product-card"
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
  const selectedCategorySlug = resolvedSearchParams.cat
  const categories = await getCategories()
  const categoryBySlug = new Map(
    categories.map((category) => [category.slug, category])
  )
  const childrenByParentId = categories.reduce((map, category) => {
    const key = category.parentId ?? "root"
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key).push(category)
    return map
  }, new Map<string, typeof categories>())
  const selectedCategory = selectedCategorySlug
    ? categoryBySlug.get(selectedCategorySlug)
    : null
  const selectedChildren = selectedCategory
    ? childrenByParentId.get(selectedCategory.id) ?? []
    : []
  const selectedSlugs =
    selectedCategory
      ? [selectedCategory.slug, ...selectedChildren.map((child) => child.slug)]
      : undefined
  const audienceContext = await resolveAudienceContext({
    searchParams: resolvedSearchParams,
  })
  const filteredProducts = await getProducts({
    categorySlugs: selectedSlugs,
    audience: audienceContext?.audience,
  })
  const activeCategory = categories.find(
    (category) => category.slug === selectedCategorySlug
  )
  const activeCategoryLabel = activeCategory
    ? activeCategory.name
    : selectedCategorySlug
      ? "Neznáma kategória"
      : "Všetky produkty"

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Breadcrumb className="w-fit text-xs">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Domov</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Katalóg</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl font-semibold tracking-tight">Katalóg</h1>
        <p className="text-muted-foreground">
          Kompletný prehľad našich produktov podľa kategórie.
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 lg:w-64 lg:sticky lg:top-24">
          <div className="rounded-xl border bg-card">
            <CatalogSidebar categories={categories} />
          </div>
        </aside>

        <div className="flex-1 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Kategória:</span>
              <span className="font-semibold text-foreground">
                {activeCategoryLabel}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredProducts.length} produktov
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
                <p>Nenašli sme produkty v tejto kategórii.</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/catalog">Zobraziť všetky produkty</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredProducts.map((product) => {
                return <ProductCard key={product.slug} product={product} />
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
