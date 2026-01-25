import Link from "next/link"
import { Suspense } from "react"
import { cacheLife, cacheTag } from "next/cache"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDeleteForm } from "@/components/admin/confirm-delete-form"
import { getPrisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"
import { getAdminCategories } from "@/lib/catalog"
import { createCategory, updateCategory, deleteCategory } from "./actions"

export default function AdminCategoriesPage() {
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
      <AdminCategoriesContent />
    </Suspense>
  )
}

async function AdminCategoriesContent() {
  await requireAdmin()

  const categories = await getAdminCategories()

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Administrácia</h1>
        <p className="text-sm text-muted-foreground">
          Nastavenia kategórií a ich štruktúry.
        </p>
      </header>

      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">Produkty</Link>
        </Button>
        <Button variant="secondary" size="sm">
          Kategórie
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/vlastnosti">Vlastnosti</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="py-6">
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
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
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
            Počet kategórií: {categories.length}
          </div>

          {categories.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Zatiaľ tu nie sú žiadne kategórie.
            </div>
          ) : (
            <div className="rounded-lg border">
              <div className="grid grid-cols-[1.2fr_1fr_1.1fr_0.8fr_0.8fr_0.9fr_1fr_auto] gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
                <span>Názov / Slug</span>
                <span>Obrázok</span>
                <span>Popis</span>
                <span>Nadradená</span>
                <span>Poradie</span>
                <span>Stav</span>
                <span>Režim</span>
                <span className="text-right">Akcia</span>
              </div>
              {categories.map((category) => {
                const hasRelations =
                  category._count.products > 0 || category._count.children > 0

                return (
                  <form
                    key={category.id}
                    action={updateCategory.bind(null, {
                      categoryId: category.id,
                    })}
                    className="grid grid-cols-[1.2fr_1fr_1.1fr_0.8fr_0.8fr_0.9fr_1fr_auto] items-start gap-3 border-b px-4 py-3 text-sm last:border-b-0"
                  >
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Názov
                        </Label>
                        <Input name="name" defaultValue={category.name} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Slug
                        </Label>
                        <Input name="slug" defaultValue={category.slug} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Obrázok
                      </Label>
                      <Input name="image" defaultValue={category.image} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Popis
                      </Label>
                      <Textarea
                        name="description"
                        defaultValue={category.description ?? ""}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Nadradená
                      </Label>
                      <select
                        name="parentId"
                        className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                        defaultValue={category.parentId ?? "none"}
                      >
                        <option value="none">Bez nadradenej</option>
                        {categories
                          .filter((item) => item.id !== category.id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Poradie
                      </Label>
                      <Input
                        name="sortOrder"
                        type="number"
                        defaultValue={category.sortOrder}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Stav
                      </Label>
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
                      <Label className="text-xs text-muted-foreground">
                        Režim
                      </Label>
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
                      <Button type="submit" size="xs">
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
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
