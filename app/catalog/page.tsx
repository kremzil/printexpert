import Image from "next/image"
import Link from "next/link"

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
import { getCategories, getProducts } from "@/lib/catalog"

type CatalogPageProps = {
  searchParams?: Promise<{
    cat?: string
  }>
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const selectedCategorySlug = resolvedSearchParams.cat
  const categories = await getCategories()
  const filteredProducts = await getProducts({
    categorySlug: selectedCategorySlug,
  })
  const categoryById = new Map(categories.map((category) => [category.id, category]))
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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          asChild
          size="sm"
          variant={activeCategory ? "outline" : "default"}
        >
          <Link href="/catalog">Všetky</Link>
        </Button>
        {categories.map((category) => {
          const isActive = activeCategory?.slug === category.slug

          return (
            <Button
              key={category.slug}
              asChild
              size="sm"
              variant={isActive ? "default" : "outline"}
            >
              <Link href={`/catalog?cat=${category.slug}`}>{category.name}</Link>
            </Button>
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
            Nenašli sme produkty v tejto kategórii. Skúste filter "Všetky".
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const category = categoryById.get(product.categoryId)
            const primaryImage = product.images[0]

            return (
              <Link
                key={product.slug}
                href={`/product/${product.slug}`}
                className="group"
              >
                <Card className="h-full overflow-hidden py-0 transition-colors group-hover:border-primary/30">
                  <CardHeader className="p-0">
                    <div className="relative aspect-[4/3] w-full">
                      <Image
                        src={primaryImage.url}
                        alt={primaryImage.alt ?? product.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 px-4 pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base">{product.name}</CardTitle>
                      {product.priceFrom ? (
                        <span className="text-sm text-muted-foreground">
                          {product.priceFrom.toString()} €
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Na vyžiadanie
                        </span>
                      )}
                    </div>
                    {category ? (
                      <Badge variant="secondary" className="w-fit">
                        {category.name}
                      </Badge>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
