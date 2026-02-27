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
import { getCategories, getCategoryProductCounts } from "@/lib/catalog"
import { buildCategoryTree } from "@/lib/category-tree"
import { buildStaticPageMetadata } from "@/lib/seo"

export const metadata = buildStaticPageMetadata("kategorie")

type PublicCategory = Awaited<ReturnType<typeof getCategories>>[number]

const buildSubtreeProductCountMap = (
  categories: PublicCategory[],
  childrenByParentId: Map<string, PublicCategory[]>,
  directProductCountByCategoryId: Map<string, number>
) => {
  const memo = new Map<string, number>()

  const visit = (id: string, seen: Set<string>) => {
    const cached = memo.get(id)
    if (typeof cached === "number") return cached
    if (seen.has(id)) return 0

    const nextSeen = new Set(seen)
    nextSeen.add(id)
    let total = directProductCountByCategoryId.get(id) ?? 0

    const children = childrenByParentId.get(id) ?? []
    for (const child of children) {
      total += visit(child.id, nextSeen)
    }

    memo.set(id, total)
    return total
  }

  for (const category of categories) {
    visit(category.id, new Set<string>())
  }

  return memo
}

export default async function CategoriesPage() {
  const [categories, productCountByCategoryId] = await Promise.all([
    getCategories(),
    getCategoryProductCounts({}),
  ])
  const { childrenByParentId, rootCategories } = buildCategoryTree(categories)
  const rootItems = rootCategories.length > 0 ? rootCategories : categories
  const subtreeProductCountByCategoryId = buildSubtreeProductCountMap(
    categories,
    childrenByParentId,
    productCountByCategoryId
  )

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
      <div className="space-y-5">
        {rootItems.map((category) => (
          <CategoryTreeNode
            key={category.id}
            category={category}
            depth={0}
            lineage={[]}
            childrenByParentId={childrenByParentId}
            subtreeProductCountByCategoryId={subtreeProductCountByCategoryId}
          />
        ))}
      </div>
    </section>
  )
}

function CategoryTreeNode({
  category,
  depth,
  lineage,
  childrenByParentId,
  subtreeProductCountByCategoryId,
}: {
  category: PublicCategory
  depth: number
  lineage: string[]
  childrenByParentId: Map<string, PublicCategory[]>
  subtreeProductCountByCategoryId: Map<string, number>
}) {
  const lineageSet = new Set(lineage)
  const children = (childrenByParentId.get(category.id) ?? []).filter(
    (child) => !lineageSet.has(child.id)
  )
  const subtreeCount =
    subtreeProductCountByCategoryId.get(category.id) ?? 0

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-card ${
        depth === 0 ? "border-primary/25 shadow-sm" : "border-border/80"
      }`}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        <Link
          href={`/kategorie/${category.slug}`}
          className="relative block h-24 w-24 shrink-0 overflow-hidden rounded-lg border"
        >
          <Image
            src={category.image}
            alt={category.name}
            fill
            className="object-cover transition-transform duration-300 hover:scale-[1.03]"
            sizes="96px"
          />
        </Link>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 text-base font-semibold">
              <Link
                href={`/kategorie/${category.slug}`}
                className="truncate hover:text-primary"
              >
                {category.name}
              </Link>
            </h2>
            <Badge variant="secondary">{subtreeCount} produktov</Badge>
          </div>

          {category.description ? (
            <p className="text-sm text-muted-foreground">
              {category.description}
            </p>
          ) : null}

          <Link
            href={`/kategorie/${category.slug}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Otvoriť kategóriu
          </Link>
        </div>
      </div>

      {children.length > 0 ? (
        <div className="border-t bg-muted/15 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">
            Podkategórie ({children.length})
          </p>
          <div className="mt-3 space-y-3 border-l border-border/70 pl-4">
            {children.map((child) => (
              <CategoryTreeNode
                key={child.id}
                category={child}
                depth={depth + 1}
                lineage={[...lineage, category.id]}
                childrenByParentId={childrenByParentId}
                subtreeProductCountByCategoryId={subtreeProductCountByCategoryId}
              />
            ))}
          </div>
        </div>
      ) : null}
    </article>
  )
}
