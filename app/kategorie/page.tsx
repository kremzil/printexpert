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

const productCountByCategory = products.reduce((map, product) => {
  map.set(product.category, (map.get(product.category) ?? 0) + 1)
  return map
}, new Map<string, number>())

export default function CategoriesPage() {
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
              <BreadcrumbPage>Kategórie</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl font-semibold">Kategórie</h1>
        <p className="text-muted-foreground">
          Vyberte si kategóriu a pozrite si dostupné produkty.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link key={category.slug} href="/catalog" className="group">
            <Card className="h-full overflow-hidden py-0 transition-colors group-hover:border-primary/30">
              <CardHeader className="p-0">
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={category.image}
                    alt={category.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">{category.title}</CardTitle>
                  <Badge variant="secondary">
                    {productCountByCategory.get(category.slug) ?? 0} produktov
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {category.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
