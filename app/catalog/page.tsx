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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { categories } from "@/data/categories"
import { products } from "@/data/products"

const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))

export default function CatalogPage() {
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
          Kompletný prehľad našich produktov podľa kategórií.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const category = categoryBySlug.get(product.category)

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
                      src={product.image}
                      alt={product.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{product.title}</CardTitle>
                    {product.price ? (
                      <span className="text-sm text-muted-foreground">
                        {product.price} ?
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Na vyžiadanie
                      </span>
                    )}
                  </div>
                  {category ? (
                    <Badge variant="secondary" className="w-fit">
                      {category.title}
                    </Badge>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
