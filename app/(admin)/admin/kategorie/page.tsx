import Link from "next/link"
import { Suspense } from "react"
import { AdminButton as Button } from "@/components/admin/admin-button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDeleteForm } from "@/components/admin/confirm-delete-form"
import { CategoriesDndManager } from "@/components/admin/categories-dnd-manager"
import { requireAdmin } from "@/lib/auth-helpers"
import { getAdminCategories } from "@/lib/catalog"
import { createCategory, updateCategory, deleteCategory } from "./actions"

type CategoriesSearchParams = {
  q?: string | string[]
  tab?: string | string[]
}

type AdminCategory = Awaited<ReturnType<typeof getAdminCategories>>[number]

const normalizeString = (value?: string | string[]) => {
  if (!value) return ""
  if (Array.isArray(value)) return value[0] ?? ""
  return value
}

export default function AdminCategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<CategoriesSearchParams>
}) {
  return (
    <Suspense
      fallback={
        <section className="space-y-6">
          <header className="space-y-2">
            <div className="h-6 w-40 rounded bg-muted" />
            <div className="h-4 w-72 rounded bg-muted" />
          </header>
          <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
            Načítavame kategórie…
          </div>
        </section>
      }
    >
      <AdminCategoriesContent searchParamsPromise={searchParams} />
    </Suspense>
  )
}

async function AdminCategoriesContent({
  searchParamsPromise,
}: {
  searchParamsPromise?: Promise<CategoriesSearchParams>
}) {
  await requireAdmin()

  const categories = await getAdminCategories()
  const resolvedParams = searchParamsPromise ? await searchParamsPromise : {}
  const query = normalizeString(resolvedParams.q).trim().toLowerCase()
  const tabParam = normalizeString(resolvedParams.tab).trim().toLowerCase()
  const activeTab = tabParam === "sortovanie" ? "sortovanie" : "sprava"

  const parentById = new Map(categories.map((category) => [category.id, category.parentId]))
  const getDepth = (id: string) => {
    let depth = 0
    let currentParent = parentById.get(id)
    const seen = new Set<string>()
    while (currentParent && !seen.has(currentParent)) {
      seen.add(currentParent)
      depth += 1
      currentParent = parentById.get(currentParent)
    }
    return depth
  }
  const depthMap = new Map(categories.map((category) => [category.id, getDepth(category.id)]))

  const childrenByParentId = new Map<string | null, AdminCategory[]>()
  for (const category of categories) {
    const key = category.parentId ?? null
    const collection = childrenByParentId.get(key) ?? []
    collection.push(category)
    childrenByParentId.set(key, collection)
  }
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  const orderedCategories = (() => {
    const ordered: AdminCategory[] = []
    const visited = new Set<string>()
    const roots = categories.filter(
      (category) => !category.parentId || !categoryById.has(category.parentId)
    )

    const visit = (category: AdminCategory, lineage: Set<string>) => {
      if (visited.has(category.id)) return
      visited.add(category.id)
      ordered.push(category)

      const nextLineage = new Set(lineage)
      nextLineage.add(category.id)
      const children = childrenByParentId.get(category.id) ?? []
      for (const child of children) {
        if (nextLineage.has(child.id)) continue
        visit(child, nextLineage)
      }
    }

    for (const root of roots) {
      visit(root, new Set<string>())
    }

    for (const category of categories) {
      if (!visited.has(category.id)) {
        visit(category, new Set<string>())
      }
    }

    return ordered
  })()

  const descendantIdsByCategoryId = (() => {
    const memo = new Map<string, Set<string>>()

    const collect = (id: string, lineage: Set<string>) => {
      const cached = memo.get(id)
      if (cached) return cached

      const descendants = new Set<string>()
      const nextLineage = new Set(lineage)
      nextLineage.add(id)

      const children = childrenByParentId.get(id) ?? []
      for (const child of children) {
        if (nextLineage.has(child.id)) continue
        descendants.add(child.id)
        const nested = collect(child.id, nextLineage)
        for (const nestedId of nested) descendants.add(nestedId)
      }

      memo.set(id, descendants)
      return descendants
    }

    for (const category of categories) {
      collect(category.id, new Set<string>())
    }

    return memo
  })()

  const matchedIds = new Set(
    query
      ? categories
          .filter(
            (category) =>
              category.name.toLowerCase().includes(query) ||
              category.slug.toLowerCase().includes(query)
          )
          .map((category) => category.id)
      : categories.map((category) => category.id)
  )

  const visibleIds = new Set(matchedIds)

  if (query) {
    // Keep ancestors visible so results remain in tree context.
    for (const id of Array.from(matchedIds)) {
      let currentParent = parentById.get(id)
      while (currentParent && !visibleIds.has(currentParent)) {
        visibleIds.add(currentParent)
        currentParent = parentById.get(currentParent)
      }
    }

    // When a parent category matches, keep its subtree visible.
    const stack = Array.from(matchedIds)
    while (stack.length > 0) {
      const currentId = stack.pop()
      if (!currentId) continue
      const children = childrenByParentId.get(currentId) ?? []
      for (const child of children) {
        if (!visibleIds.has(child.id)) {
          visibleIds.add(child.id)
        }
        stack.push(child.id)
      }
    }
  }

  const visibleCategories = categories.filter((category) =>
    visibleIds.has(category.id)
  )
  const rootCandidates = visibleCategories.filter(
    (category) => !category.parentId || !visibleIds.has(category.parentId)
  )
  const rootCategories =
    rootCandidates.length > 0 ? rootCandidates : visibleCategories

  return (
    <section className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Administrácia</h1>
        <p className="text-sm text-muted-foreground">
          Nastavenia kategórií a ich štruktúry.
        </p>
      </header>

      <div className="mb-6 flex items-center gap-2">
        <Link href="/admin">
          <Button variant="outline" size="sm">
            Produkty
          </Button>
        </Link>
        <Button variant="secondary" size="sm">
          Kategórie
        </Button>
        <Link href="/admin/vlastnosti">
          <Button variant="outline" size="sm">
            Vlastnosti
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="py-6">
          <Tabs defaultValue={activeTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="sprava">Správa kategórií</TabsTrigger>
              <TabsTrigger value="sortovanie">Rýchle poradie</TabsTrigger>
            </TabsList>

            <TabsContent value="sprava" className="space-y-4">
              <form method="get" className="mb-4 flex items-end gap-2">
                <input type="hidden" name="tab" value="sprava" />
                <div className="space-y-1">
                  <Label htmlFor="category-search">Vyhľadávanie</Label>
                  <Input
                    id="category-search"
                    name="q"
                    defaultValue={query}
                    placeholder="Názov alebo slug kategórie"
                    className="w-80"
                  />
                </div>
                <Button type="submit" size="sm" variant="outline">
                  Hľadať
                </Button>
              </form>

              <form
                action={createCategory}
                className="mb-6 grid gap-3 md:grid-cols-[1.1fr_1fr_1.1fr_0.8fr_0.7fr_auto]"
              >
                <div className="space-y-1">
                  <Label htmlFor="category-name">Názov</Label>
                  <Input
                    id="category-name"
                    name="name"
                    placeholder="Názov kategórie…"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="category-slug">Slug</Label>
                  <Input
                    id="category-slug"
                    name="slug"
                    placeholder="Slug…"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="category-image">Obrázok (URL)</Label>
                  <Input
                    id="category-image"
                    name="image"
                    placeholder="/products/… alebo https://…"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="category-parent">Nadradená</Label>
                  <select
                    id="category-parent"
                    name="parentId"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    defaultValue="none"
                  >
                  <option value="none">Bez nadradenej</option>
                    {orderedCategories.map((category) => {
                      const depth = depthMap.get(category.id) ?? 0
                      const prefix = depth > 0 ? `${"-- ".repeat(depth)}` : ""
                      return (
                      <option key={category.id} value={category.id}>
                        {prefix}
                        {category.name}
                      </option>
                      )
                    })}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="category-sort">Poradie</Label>
                  <Input
                    id="category-sort"
                    name="sortOrder"
                    type="number"
                    defaultValue={0}
                  />
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="isActive"
                        value="1"
                        defaultChecked
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      <span>Aktívna</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="showInB2b"
                        value="1"
                        defaultChecked
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      <span>B2B</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="showInB2c"
                        value="1"
                        defaultChecked
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      <span>B2C</span>
                    </label>
                  </div>
                  <Button type="submit" size="sm">
                    Pridať kategóriu
                  </Button>
                </div>
              </form>

              <div className="mb-4 text-sm text-muted-foreground">
                Počet kategórií: {visibleCategories.length} / {categories.length}
              </div>

              {visibleCategories.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Zatiaľ tu nie sú žiadne kategórie.
                </div>
              ) : (
                <div className="space-y-4">
                  {rootCategories.map((category) => (
                    <CategoryTreeNode
                      key={category.id}
                      category={category}
                      orderedCategories={orderedCategories}
                      descendantIdsByCategoryId={descendantIdsByCategoryId}
                      depthMap={depthMap}
                      query={query}
                      lineage={[]}
                      getVisibleChildren={(parentId) =>
                        (childrenByParentId.get(parentId) ?? []).filter((child) =>
                          visibleIds.has(child.id)
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sortovanie" className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Rýchle poradie (drag & drop)</h2>
                <p className="text-xs text-muted-foreground">
                  Presúvajte kategórie v rámci úrovne a uložte poradie.
                </p>
              </div>
              <CategoriesDndManager
                categories={categories.map((category) => ({
                  id: category.id,
                  name: category.name,
                  parentId: category.parentId,
                  sortOrder: category.sortOrder,
                }))}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  )
}

function CategoryTreeNode({
  category,
  orderedCategories,
  descendantIdsByCategoryId,
  depthMap,
  query,
  lineage,
  getVisibleChildren,
}: {
  category: AdminCategory
  orderedCategories: AdminCategory[]
  descendantIdsByCategoryId: Map<string, Set<string>>
  depthMap: Map<string, number>
  query: string
  lineage: string[]
  getVisibleChildren: (parentId: string) => AdminCategory[]
}) {
  const lineageSet = new Set(lineage)
  const depth = lineage.length
  const children = getVisibleChildren(category.id).filter(
    (child) => !lineageSet.has(child.id)
  )

  return (
    <article className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 ${
          depth === 0
            ? "border-primary/35 bg-primary/10"
            : "border-primary/20 bg-primary/5"
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-primary">{category.name}</p>
          <p className="truncate text-xs text-muted-foreground">/{category.slug}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Produkty: {category._count.products}</span>
          <span>Podkategórie: {category._count.children}</span>
        </div>
      </div>

      <div className="p-4">
        <CategoryEditForm
          category={category}
          orderedCategories={orderedCategories}
          descendantIdsByCategoryId={descendantIdsByCategoryId}
          depthMap={depthMap}
        />
      </div>

      {children.length > 0 ? (
        <details className="border-t bg-muted/10 px-4 py-3" open={Boolean(query)}>
          <summary className="cursor-pointer text-sm font-medium">
            Podkategórie ({children.length})
          </summary>
          <div className="mt-3 space-y-4 border-l pl-4">
            {children.map((child) => (
              <CategoryTreeNode
                key={child.id}
                category={child}
                orderedCategories={orderedCategories}
                descendantIdsByCategoryId={descendantIdsByCategoryId}
                depthMap={depthMap}
                query={query}
                lineage={[...lineage, category.id]}
                getVisibleChildren={getVisibleChildren}
              />
            ))}
          </div>
        </details>
      ) : null}
    </article>
  )
}

function CategoryEditForm({
  category,
  orderedCategories,
  descendantIdsByCategoryId,
  depthMap,
}: {
  category: AdminCategory
  orderedCategories: AdminCategory[]
  descendantIdsByCategoryId: Map<string, Set<string>>
  depthMap: Map<string, number>
}) {
  const hasRelations = category._count.products > 0 || category._count.children > 0
  const blockedIds = descendantIdsByCategoryId.get(category.id) ?? new Set<string>()

  return (
    <form
      action={updateCategory.bind(null, {
        categoryId: category.id,
      })}
      className="grid grid-cols-1 items-start gap-3 text-sm xl:grid-cols-[1.2fr_1fr_1.1fr_0.8fr_0.8fr_0.9fr_1fr_auto]"
    >
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Názov</Label>
          <Input name="name" defaultValue={category.name} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Slug</Label>
          <Input name="slug" defaultValue={category.slug} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Obrázok</Label>
        <Input name="image" defaultValue={category.image} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Popis</Label>
        <Textarea
          name="description"
          defaultValue={category.description ?? ""}
          rows={3}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Nadradená</Label>
        <select
          name="parentId"
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          defaultValue={category.parentId ?? "none"}
        >
          <option value="none">Bez nadradenej</option>
          {orderedCategories
            .filter((item) => item.id !== category.id && !blockedIds.has(item.id))
            .map((item) => {
              const itemDepth = depthMap.get(item.id) ?? 0
              const prefix = itemDepth > 0 ? `${"-- ".repeat(itemDepth)}` : ""
              return (
                <option key={item.id} value={item.id}>
                  {prefix}
                  {item.name}
                </option>
              )
            })}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Poradie</Label>
        <Input
          name="sortOrder"
          type="number"
          defaultValue={category.sortOrder}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Stav</Label>
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="isActive"
            value="1"
            defaultChecked={category.isActive}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <span>{category.isActive ? "Aktívna" : "Neaktívna"}</span>
        </label>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Režim</Label>
        <div className="flex flex-col gap-2 text-xs">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="showInB2b"
              value="1"
              defaultChecked={category.showInB2b}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span>B2B</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="showInB2c"
              value="1"
              defaultChecked={category.showInB2c}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span>B2C</span>
          </label>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="submit" size="sm">
          Uložiť
        </Button>
        <ConfirmDeleteForm
          action={deleteCategory.bind(null, {
            categoryId: category.id,
            categoryName: category.name,
            hasRelations,
          })}
          triggerText="Odstrániť"
          title="Odstrániť kategóriu?"
          description={
            hasRelations
              ? "Kategória obsahuje produkty alebo podkategórie. Odstráňte najprv väzby."
              : "Kategóriu odstránite natrvalo."
          }
        />
      </div>
    </form>
  )
}
