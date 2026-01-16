import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent } from "@/components/ui/card"
import { categories } from "@/data/categories"
import { products } from "@/data/products"

const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))

type ProductPageProps = {
  params: Promise<{
    slug: string
  }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const product = products.find((item) => item.slug === slug)

  if (!product) {
    notFound()
  }

  const category = categoryBySlug.get(product.categorySlug)

  return (
    <section className="space-y-6">
      <Breadcrumb className="w-fit text-xs">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Domov</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/catalog">Katalóg</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{product.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border">
          <Image
            src={product.image}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 520px, 100vw"
          />
        </div>
        <Card className="py-6">
          <CardContent className="space-y-3">
            <h1 className="text-2xl font-semibold">{product.title}</h1>
            {category ? (
              <Badge variant="secondary" className="w-fit">
                {category.name}
              </Badge>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Tento produkt vám radi pripravíme podľa vašich požiadaviek.
            </p>
            {product.price ? (
              <div className="text-lg font-semibold">{product.price} €</div>
            ) : (
              <div className="text-sm text-muted-foreground">Cena na vyžiadanie</div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
