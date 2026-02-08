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
import { getCategories, getCategoryProductCounts } from "@/lib/catalog"

export default async function CategoriesPage() {
  const [categories, productCountByCategoryId] = await Promise.all([
    getCategories(),
    getCategoryProductCounts({}),
  ])
  const categorySlugById = new Map(
    categories.map((category) => [category.id, category.slug])
  )
  const childrenByParentId = categories.reduce((map, category) => {
    const key = category.parentId ?? "root"
    const list = map.get(key) ?? []
    list.push(category)
    map.set(key, list)
    return map
  }, new Map<string, typeof categories>())
  const rootCategories = childrenByParentId.get("root") ?? []
  const productCountByCategory = new Map<string, number>()
  categorySlugById.forEach((slug, categoryId) => {
    productCountByCategory.set(
      slug,
      productCountByCategoryId.get(categoryId) ?? 0
    )
  })

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
      <div className="space-y-8">
        {rootCategories.map((category) => {
          const children = childrenByParentId.get(category.id) ?? []
          const hasChildren = children.length > 0
          const groups = hasChildren ? children : [category]

          return (
            <div key={category.slug} className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{category.name}</h2>
                {category.description ? (
                  <p className="text-sm text-muted-foreground">
                    {category.description}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/catalog?cat=${item.slug}`}
                    className="group"
                  >
                    <Card className="h-full overflow-hidden py-0 transition-colors group-hover:border-primary/30">
                      <CardHeader className="p-4">
                        <div className="relative aspect-square w-full">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 px-4 pb-4">
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle className="text-base">{item.name}</CardTitle>
                          <Badge variant="secondary">
                            {productCountByCategory.get(item.slug) ?? 0} produktov
                          </Badge>
                        </div>
                        {item.description ? (
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
