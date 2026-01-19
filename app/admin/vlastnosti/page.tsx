
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ConfirmDeleteForm } from "@/components/admin/confirm-delete-form"
import { getPrisma } from "@/lib/prisma"
import { createAttribute, deleteAttribute } from "./actions"

export default async function AdminPropertiesPage() {
  const prisma = getPrisma()
  const attributes = await prisma.wpAttributeTaxonomy.findMany({
    orderBy: [{ attributeLabel: "asc" }, { attributeName: "asc" }],
  })

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Administrácia</h1>
        <p className="text-sm text-muted-foreground">
          Správa vlastností a ich nastavení.
        </p>
      </header>

      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">Produkty</Link>
        </Button>
        <Button variant="secondary" size="sm">
          Vlastnosti
        </Button>
      </div>

      <Card>
        <CardContent className="py-6">
          <form
            action={createAttribute}
            className="mb-6 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]"
          >
            <Input name="label" placeholder="Názov vlastnosti" />
            <Input name="name" placeholder="Slug (napr. farba)" />
            <Input name="type" placeholder="Typ (napr. select)" />
            <Button type="submit" size="sm">
              Pridať vlastnosť
            </Button>
          </form>
          <div className="mb-4 text-sm text-muted-foreground">
            Počet vlastností: {attributes.length}
          </div>
          {attributes.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Zatiaľ tu nie sú žiadne vlastnosti.
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {attributes.map((attr) => (
                    <tr key={attr.attributeId} className="border-b last:border-b-0">
                      <td className="px-2 py-2 font-medium">
                        {attr.attributeLabel || attr.attributeName}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {attr.attributeName}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {attr.attributeType ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild size="xs" variant="outline">
                            <Link href={`/admin/vlastnosti/${attr.attributeId}`}>
                              Otvoriť
                            </Link>
                          </Button>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
