
import Link from "next/link"
import { Suspense } from "react"
import { AdminButton } from "@/components/admin/admin-button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDeleteForm } from "@/components/admin/confirm-delete-form"
import { getPrisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"
import { createAttribute, deleteAttribute, updateAttribute } from "./actions"

type AttributesSearchParams = {
  q?: string | string[]
}

const normalizeString = (value?: string | string[]) => {
  if (!value) return ""
  if (Array.isArray(value)) return value[0] ?? ""
  return value
}

async function getAdminAttributes() {
  const prisma = getPrisma()
  return prisma.wpAttributeTaxonomy.findMany({
    orderBy: [{ attributeLabel: "asc" }, { attributeName: "asc" }],
  })
}

export default function AdminPropertiesPage({
  searchParams,
}: {
  searchParams?: Promise<AttributesSearchParams>
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
            Načítavame vlastnosti…
          </div>
        </section>
      }
    >
      <AdminPropertiesContent searchParamsPromise={searchParams} />
    </Suspense>
  )
}

async function AdminPropertiesContent({
  searchParamsPromise,
}: {
  searchParamsPromise?: Promise<AttributesSearchParams>
}) {
  await requireAdmin()

  const attributes = await getAdminAttributes()
  const resolvedParams = searchParamsPromise ? await searchParamsPromise : {}
  const query = normalizeString(resolvedParams.q).trim().toLowerCase()
  const filteredAttributes = query
    ? attributes.filter(
        (attr) =>
          attr.attributeLabel.toLowerCase().includes(query) ||
          attr.attributeName.toLowerCase().includes(query)
      )
    : attributes

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Vlastnosti</h1>
        <p className="text-muted-foreground">
          Správa vlastností a ich nastavení.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Link href="/admin">
          <AdminButton variant="outline" size="sm">
            Produkty
          </AdminButton>
        </Link>
        <Link href="/admin/kategorie">
          <AdminButton variant="outline" size="sm">
            Kategórie
          </AdminButton>
        </Link>
        <AdminButton variant="secondary" size="sm">
          Vlastnosti
        </AdminButton>
      </div>

      <Card>
        <CardContent className="py-6">
          <form method="get" className="mb-4 flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="attribute-search">Vyhľadávanie</Label>
              <Input
                id="attribute-search"
                name="q"
                defaultValue={query}
                placeholder="Názov alebo slug vlastnosti"
                className="w-80"
              />
            </div>
            <AdminButton type="submit" size="sm" variant="outline">
              Hľadať
            </AdminButton>
          </form>

          <form
            action={createAttribute}
            className="mb-6 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]"
          >
            <div className="space-y-1">
              <Label htmlFor="attribute-label">Názov vlastnosti</Label>
              <Input
                id="attribute-label"
                name="label"
                placeholder="Názov vlastnosti… (napr. Formát)"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="attribute-name">Slug</Label>
              <Input
                id="attribute-name"
                name="name"
                placeholder="Slug… (napr. farba)"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="attribute-type">Typ</Label>
              <Input
                id="attribute-type"
                name="type"
                placeholder="Typ… (napr. select)"
              />
            </div>
            <AdminButton type="submit" size="sm">
              Pridať vlastnosť
            </AdminButton>
          </form>
          <div className="mb-4 text-sm text-muted-foreground">
            Počet vlastností: {filteredAttributes.length} / {attributes.length}
          </div>
          {filteredAttributes.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Zatiaľ tu nie sú žiadne vlastnosti.
            </div>
          ) : (
            <div className="table-responsive rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 font-medium">Názov</th>
                    <th className="px-2 py-2 font-medium">Slug</th>
                    <th className="px-2 py-2 font-medium">Typ</th>
                    <th className="px-2 py-2 text-right font-medium">Akcia</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttributes.map((attr) => (
                    <tr key={attr.attributeId} className="border-b last:border-b-0">
                      <td colSpan={4} className="px-2 py-3">
                        <form
                          action={updateAttribute.bind(null, { attributeId: attr.attributeId })}
                          className="grid gap-2 md:grid-cols-[1.3fr_1fr_1fr_auto]"
                        >
                          <Input name="label" defaultValue={attr.attributeLabel || attr.attributeName} />
                          <Input name="name" defaultValue={attr.attributeName} />
                          <Input name="type" defaultValue={attr.attributeType ?? ""} />
                          <div className="flex items-center justify-end gap-2">
                            <AdminButton type="submit" size="sm" variant="outline">
                              Uložiť
                            </AdminButton>
                            <AdminButton asChild size="sm" variant="outline">
                              <Link href={`/admin/vlastnosti/${attr.attributeId}`}>Otvoriť</Link>
                            </AdminButton>
                            <ConfirmDeleteForm
                              action={deleteAttribute.bind(null, {
                                attributeId: attr.attributeId,
                                attributeName: attr.attributeName,
                              })}
                              triggerText="Odstrániť"
                              title="Odstrániť vlastnosť?"
                              description="Odstránite vlastnosť aj všetky jej hodnoty a väzby."
                            />
                          </div>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
