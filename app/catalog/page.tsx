import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const categoryById = new Map(
    categories.map((category) => [category.id, category])
  )
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
  const rootCategories = childrenByParentId.get("root") ?? []
  const selectedCategory = selectedCategorySlug
    ? categoryBySlug.get(selectedCategorySlug)
    : null
  const selectedChildren = selectedCategory
    ? childrenByParentId.get(selectedCategory.id) ?? []
    : []
  const selectedSlugs =
    selectedCategory && selectedChildren.length > 0
      ? [selectedCategory.slug, ...selectedChildren.map((child) => child.slug)]
      : selectedCategory
        ? [selectedCategory.slug]
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
    <section className="space-y-6">
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
        <h1 className="text-2xl font-semibold">Katalóg</h1>
        <p className="text-muted-foreground">
          Kompletný prehľad našich produktov podľa kategórie.
        </p>
      </div>
      <div className="space-y-3">
        <Button
          asChild
          size="sm"
          variant={activeCategory ? "outline" : "default"}
        >
          <Link href="/catalog">Všetky</Link>
        </Button>
        {rootCategories.map((category) => {
          const children = childrenByParentId.get(category.id) ?? []
          const isActiveParent =
            activeCategory?.slug === category.slug ||
            children.some((child) => child.slug === activeCategory?.slug)

          return (
            <div key={category.slug} className="flex flex-wrap items-center gap-2">
              <Button
                asChild
                size="sm"
                variant={isActiveParent ? "default" : "outline"}
              >
                <Link href={`/catalog?cat=${category.slug}`}>
                  {category.name}
                </Link>
              </Button>
              {children.map((child) => {
                const isActive = activeCategory?.slug === child.slug

                return (
                  <Button
                    key={child.slug}
                    asChild
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                  >
                    <Link href={`/catalog?cat=${child.slug}`}>
                      {child.name}
                    </Link>
                  </Button>
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          Aktívna kategória:{" "}
          <span className="font-medium text-foreground">
            {activeCategoryLabel}
          </span>
        </span>
        <span>{filteredProducts.length} produktov</span>
      </div>
      {filteredProducts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-sm text-muted-foreground">
            Nenašli sme produkty v tejto kategórii. Skúste filter &quot;Všetky&quot;.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const category = categoryById.get(product.categoryId)

            return (
              <ProductCard key={product.slug} product={product} category={category} />
            )
          })}
        </div>
      )}
    </section>
  )
}
