
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { cacheLife, cacheTag } from "next/cache"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getPrisma } from "@/lib/prisma"
import { createTerm, deleteTerm } from "./actions"

type AdminPropertyPageProps = {
  params: Promise<{
    attributeId: string
  }>
}

async function getAttributeDetails(attributeId: number) {
  "use cache"
  cacheTag("attributes")
  cacheLife("minutes")
  const prisma = getPrisma()
  const attribute = await prisma.wpAttributeTaxonomy.findUnique({
    where: { attributeId },
  })

  if (!attribute) {
    return { attribute: null, termTaxonomies: [], terms: [], taxonomy: "" }
  }

  const taxonomy = `pa_${attribute.attributeName}`
  const termTaxonomies = await prisma.wpTermTaxonomy.findMany({
    where: { taxonomy },
  })
  const termIds = termTaxonomies.map((row) => row.termId)
  const terms = termIds.length
    ? await prisma.wpTerm.findMany({
        where: { termId: { in: termIds } },
        orderBy: [{ name: "asc" }],
      })
    : []

  return { attribute, termTaxonomies, terms, taxonomy }
}

export default async function AdminPropertyPage({
  params,
}: AdminPropertyPageProps) {
  return (
    <Suspense
      fallback={
        <section className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-7 w-1/2 rounded bg-muted" />
          </div>
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            Načítavame vlastnosť…
          </div>
        </section>
      }
    >
      <AdminPropertyDetails paramsPromise={params} />
    </Suspense>
  )
}

async function AdminPropertyDetails({
  paramsPromise,
}: {
  paramsPromise: AdminPropertyPageProps["params"]
}) {
  const { attributeId } = await paramsPromise
  const { attribute, termTaxonomies, terms, taxonomy } =
    await getAttributeDetails(Number(attributeId))

  if (!attribute) {
    notFound()
  }

  const termById = new Map(terms.map((term) => [term.termId, term]))

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Administrácia</div>
          <h1 className="text-2xl font-semibold">
            {attribute.attributeLabel || attribute.attributeName}
          </h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/vlastnosti">Späť na vlastnosti</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-6 py-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">Slug: {attribute.attributeName}</Badge>
            <Badge variant="outline">Taxonómia: {taxonomy}</Badge>
            <span className="text-muted-foreground">
              Typ: {attribute.attributeType ?? "—"}
            </span>
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>Hodnoty</span>
              <span>Počet: {termTaxonomies.length}</span>
            </div>
            <div className="border-b px-4 py-4">
              <form
                action={createTerm.bind(null, {
                  attributeId: attribute.attributeId,
                  attributeName: attribute.attributeName,
                })}
                className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]"
              >
                <Input name="name" placeholder="Názov hodnoty" />
                <Input name="slug" placeholder="Slug (napr. matny-papier)" />
                <Button type="submit" size="sm">
                  Pridať hodnotu
                </Button>
              </form>
            </div>
            {termTaxonomies.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                Zatiaľ tu nie sú žiadne hodnoty.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-2 py-2 font-medium">Názov</th>
                      <th className="px-2 py-2 font-medium">Slug</th>
                      <th className="px-2 py-2 font-medium">ID</th>
                      <th className="px-2 py-2 text-right font-medium">Akcia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {termTaxonomies.map((row) => {
                      const term = termById.get(row.termId)
                      return (
                        <tr key={row.termTaxonomyId} className="border-b last:border-b-0">
                          <td className="px-2 py-2 font-medium">
                            {term?.name ?? `Term ${row.termId}`}
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">
                            {term?.slug ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">
                            {row.termId}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <form
                              action={deleteTerm.bind(null, {
                                attributeId: attribute.attributeId,
                                termId: row.termId,
                                termTaxonomyId: row.termTaxonomyId,
                              })}
                            >
                              <Button size="xs" variant="destructive" type="submit">
                                Odstrániť
                              </Button>
                            </form>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
