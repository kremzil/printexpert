
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { cacheLife, cacheTag } from "next/cache"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDeleteForm } from "@/components/admin/confirm-delete-form"
import { getAdminProductById } from "@/lib/catalog"
import { getPrisma } from "@/lib/prisma"
import { getWpCalculatorData } from "@/lib/wp-calculator"
import {
  createMatrix,
  createMatrixPriceRows,
  deleteMatrix,
  updateProductWpId,
  updateMatrixPrices,
} from "./actions"

type AdminProductPageProps = {
  params: Promise<{
    id: string
  }>
}

async function getAttributesWithTerms() {
  "use cache"
  cacheTag("attributes")
  cacheLife("minutes")
  const prisma = getPrisma()
  const attributes = await prisma.wpAttributeTaxonomy.findMany({
    orderBy: [{ attributeLabel: "asc" }, { attributeName: "asc" }],
  })
  const taxonomies = attributes.map(
    (attribute) => `pa_${attribute.attributeName}`
  )
  const termTaxonomies = taxonomies.length
    ? await prisma.wpTermTaxonomy.findMany({
        where: { taxonomy: { in: taxonomies } },
      })
    : []
  const termIds = Array.from(
    new Set(termTaxonomies.map((row) => row.termId))
  )
  const terms = termIds.length
    ? await prisma.wpTerm.findMany({
        where: { termId: { in: termIds } },
        orderBy: [{ name: "asc" }],
      })
    : []

  return { attributes, termTaxonomies, terms }
}

export default async function AdminProductPage({
  params,
}: AdminProductPageProps) {
  return (
    <Suspense
      fallback={
        <section className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-7 w-1/2 rounded bg-muted" />
          </div>
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            Načítavame administráciu produktu…
          </div>
        </section>
      }
    >
      <AdminProductDetails paramsPromise={params} />
    </Suspense>
  )
}

async function AdminProductDetails({
  paramsPromise,
}: {
  paramsPromise: AdminProductPageProps["params"]
}) {
  const { id } = await paramsPromise
  const [product, attributeData] = await Promise.all([
    getAdminProductById(id),
    getAttributesWithTerms(),
  ])

  if (!product) {
    notFound()
  }

  const calculatorData = product.wpProductId
    ? await getWpCalculatorData(product.wpProductId)
    : null
  const ntpLabelByValue: Record<string, string> = {
    "0": "Fixná",
    "2": "Plocha (šírka × výška)",
    "3": "Obvod",
    "4": "Šírka × 2",
  }
  const selectClassName =
    "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
  const { attributes, termTaxonomies, terms } = attributeData
  const termById = new Map(terms.map((term) => [term.termId, term]))
  const termIdsByTaxonomy = new Map<string, number[]>()
  termTaxonomies.forEach((row) => {
    const list = termIdsByTaxonomy.get(row.taxonomy) ?? []
    list.push(row.termId)
    termIdsByTaxonomy.set(row.taxonomy, list)
  })
  const attributesWithTerms = attributes.map((attribute) => {
    const taxonomy = `pa_${attribute.attributeName}`
    const ids = termIdsByTaxonomy.get(taxonomy) ?? []
    const attributeTerms = ids
      .map((termId) => termById.get(termId))
      .filter((term): term is NonNullable<typeof term> => Boolean(term))
      .sort((a, b) => a.name.localeCompare(b.name))
    return {
      attribute,
      taxonomy,
      terms: attributeTerms,
    }
  })

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Administrácia</div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">Späť na produkty</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-6 py-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={product.isActive ? "secondary" : "outline"}>
              {product.isActive ? "Aktívny" : "Neaktívny"}
            </Badge>
            <span className="text-muted-foreground">
              Kategória: {product.category?.name ?? "Bez kategórie"}
            </span>
          </div>

          <Separator />

          <form className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Názov</Label>
                <Input id="name" name="name" defaultValue={product.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" defaultValue={product.slug} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Krátky popis</Label>
              <Textarea
                id="excerpt"
                name="excerpt"
                rows={3}
                defaultValue={product.excerpt ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Detailný popis</Label>
              <Textarea
                id="description"
                name="description"
                rows={6}
                defaultValue={product.description ?? ""}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priceFrom">Cena od</Label>
                <Input
                  id="priceFrom"
                  name="priceFrom"
                  defaultValue={product.priceFrom?.toString() ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatRate">DPH</Label>
                <Input
                  id="vatRate"
                  name="vatRate"
                  defaultValue={product.vatRate.toString()}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Zmeny sa zatiaľ neukladajú.</span>
              <Button type="button" variant="secondary" size="sm" disabled>
                Uložiť zmeny
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Matice cien</h2>
              <p className="text-sm text-muted-foreground">
                Dáta z WP tabuliek pre výpočet ceny.
              </p>
            </div>
            {product.wpProductId ? (
              <Badge variant="outline">WP ID: {product.wpProductId}</Badge>
            ) : (
              <Badge variant="outline">Bez WP ID</Badge>
            )}
          </div>

          <form
            action={updateProductWpId.bind(null, { productId: product.id })}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="space-y-2">
              <Label htmlFor="wpProductId">WP ID</Label>
              <Input
                id="wpProductId"
                name="wpProductId"
                type="number"
                inputMode="numeric"
                placeholder="Napríklad 1424…"
                defaultValue={product.wpProductId?.toString() ?? ""}
              />
            </div>
            <Button type="submit" size="sm">
              Uložiť WP ID
            </Button>
          </form>

          {product.wpProductId ? (
            <form
              action={createMatrix.bind(null, {
                productId: product.id,
                wpProductId: product.wpProductId,
              })}
              className="grid gap-4"
            >
              <div className="grid gap-3 md:grid-cols-[1.3fr_0.9fr_0.9fr_1.3fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="matrix-title">Názov matice</Label>
                  <Input
                    id="matrix-title"
                    name="title"
                    placeholder="Názov matice… (napr. Základná A4)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matrix-kind">Typ matice</Label>
                  <select
                    id="matrix-kind"
                    name="kind"
                    className={selectClassName}
                    defaultValue="simple"
                  >
                    <option value="simple">Základná</option>
                    <option value="finishing">Dokončovacia</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matrix-num-type">Typ množstva</Label>
                  <select
                    id="matrix-num-type"
                    name="numType"
                    className={selectClassName}
                    defaultValue="0"
                  >
                    <option value="0">Fixná</option>
                    <option value="2">Plocha (šírka × výška)</option>
                    <option value="3">Obvod</option>
                    <option value="4">Šírka × 2</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matrix-breakpoints">Breakpointy</Label>
                  <Input
                    id="matrix-breakpoints"
                    name="numbers"
                    placeholder="Breakpointy… (napr. 100|200|500)"
                  />
                </div>
                <Button type="submit" size="sm">
                  Pridať maticu
                </Button>
              </div>
              <div className="rounded-lg border px-4 py-4">
                <div className="text-sm font-medium">
                  Vyberte vlastnosti a hodnoty pre maticu
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Matica bude obsahovať iba vybrané hodnoty.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {attributesWithTerms.map(({ attribute, terms }) => (
                    <div key={attribute.attributeId} className="rounded-md border p-3">
                      <div className="text-sm font-medium">
                        {attribute.attributeLabel || attribute.attributeName}
                      </div>
                      {terms.length === 0 ? (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Bez hodnôt pre túto vlastnosť.
                        </div>
                      ) : (
                        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                          {terms.map((term) => (
                            <label
                              key={term.termId}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="checkbox"
                                name={`terms:${attribute.attributeId}`}
                                value={term.termId}
                                className="size-4"
                              />
                              <span>{term.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </form>
          ) : (
            <div className="text-sm text-muted-foreground">
              Najprv nastavte WP ID pre tento produkt.
            </div>
          )}

          {calculatorData ? (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-md border px-3 py-2">
                  <div className="text-xs text-muted-foreground">Počet matíc</div>
                  <div className="text-base font-semibold">
                    {calculatorData.matrices.length}
                  </div>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Počet základných cien
                  </div>
                  <div className="text-base font-semibold">
                    {Object.keys(calculatorData.globals.smatrix).length}
                  </div>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Počet dokončovacích cien
                  </div>
                  <div className="text-base font-semibold">
                    {Object.keys(calculatorData.globals.fmatrix).length}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {calculatorData.matrices.map((matrix) => {
                  const breakpoints =
                    calculatorData.globals.numbers_array[matrix.mtid]
                  const ntpLabel =
                    ntpLabelByValue[matrix.ntp] ?? `Typ ${matrix.ntp}`
                  const kindLabel =
                    matrix.kind === "finishing" ? "Dokončovacia" : "Základná"
                  const uniqueBreakpoints = Array.from(
                    new Set(matrix.prices.map((row) => row.breakpoint))
                  ).sort((a, b) => a - b)
                  const selectLabels = matrix.selects.map((select) => ({
                    aid: select.aid,
                    label: select.label,
                  }))

                  const rowsByCombo = new Map<
                    string,
                    {
                      aterms: string
                      terms: Record<string, string>
                      prices: Record<string, string>
                    }
                  >()

                  for (const row of matrix.prices) {
                    const existing =
                      rowsByCombo.get(row.aterms) ??
                      ({
                        aterms: row.aterms,
                        terms: row.terms,
                        prices: {},
                      } as const)
                    existing.prices[String(row.breakpoint)] = row.price
                    rowsByCombo.set(row.aterms, existing)
                  }

                  return (
                    <details key={matrix.mtid} className="rounded-lg border">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-sm">
                        <Badge variant="secondary">{kindLabel}</Badge>
                        <span className="text-muted-foreground">
                          MTID: {matrix.mtid}
                        </span>
                        <span className="text-muted-foreground">
                          Typ množstva: {ntpLabel}
                        </span>
                        <span className="text-muted-foreground">
                          Cenníkové položky: {matrix.prices.length}
                        </span>
                      </summary>
                      <div className="space-y-4 border-t px-4 py-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-muted-foreground">
                            Breakpointy:{" "}
                            {breakpoints ? breakpoints : "Nezadané"}
                          </div>
                          {matrix.prices.length === 0 ? (
                            <form
                              action={createMatrixPriceRows.bind(null, {
                                productId: product.id,
                                mtypeId: Number(matrix.mtid),
                              })}
                            >
                              <Button size="xs" variant="outline" type="submit">
                                Vygenerovať ceny
                              </Button>
                            </form>
                          ) : null}
                          <ConfirmDeleteForm
                            action={deleteMatrix.bind(null, {
                              productId: product.id,
                              mtypeId: Number(matrix.mtid),
                            })}
                            triggerText="Odstrániť maticu"
                            title="Odstrániť maticu?"
                            description="Týmto krokom odstránite maticu aj všetky jej ceny."
                          />
                        </div>
                        <div className="space-y-2">
                          {matrix.selects.map((select) => (
                            <div
                              key={select.aid}
                              className="rounded-md bg-muted/30 px-3 py-2"
                            >
                              <div className="text-xs text-muted-foreground">
                                Atribút {select.aid}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2 text-sm">
                                {select.options.length > 0 ? (
                                  select.options.map((option) => (
                                    <Badge key={option.value} variant="outline">
                                      {option.label}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground">
                                    Bez možností
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <form
                          action={updateMatrixPrices.bind(null, {
                            productId: product.id,
                            mtypeId: Number(matrix.mtid),
                          })}
                          className="space-y-3"
                        >
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="text-xs text-muted-foreground">
                                <tr className="border-b">
                                  {selectLabels.map((select) => (
                                    <th
                                      key={select.aid}
                                      className="px-2 py-2 font-medium"
                                    >
                                      {select.label}
                                    </th>
                                  ))}
                                  {uniqueBreakpoints.map((breakpoint) => (
                                    <th
                                      key={breakpoint}
                                      className="px-2 py-2 font-medium text-right"
                                    >
                                      {breakpoint}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rowsByCombo.size > 0 ? (
                                  Array.from(rowsByCombo.values()).map((row) => {
                                    const rowLabel = selectLabels
                                      .map(
                                        (select) => row.terms[select.aid] ?? "—"
                                      )
                                      .filter(Boolean)
                                      .join(", ")
                                    const priceLabelBase = rowLabel
                                      ? `Cena pre ${rowLabel}`
                                      : "Cena"
                                    return (
                                      <tr
                                        key={row.aterms}
                                        className="border-b last:border-b-0"
                                      >
                                        {selectLabels.map((select) => (
                                          <td key={select.aid} className="px-2 py-2">
                                            {row.terms[select.aid] ?? "—"}
                                          </td>
                                        ))}
                                        {uniqueBreakpoints.map((breakpoint) => (
                                          <td
                                            key={`${row.aterms}-${breakpoint}`}
                                            className="px-2 py-2 text-right"
                                          >
                                            {row.prices[String(breakpoint)] ? (
                                              <input
                                                name={`price|${encodeURIComponent(
                                                  row.aterms
                                                )}|${breakpoint}`}
                                                defaultValue={row.prices[String(breakpoint)]}
                                                aria-label={`${priceLabelBase} pri ${breakpoint}`}
                                                className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-right text-sm"
                                              />
                                            ) : (
                                              "—"
                                            )}
                                          </td>
                                        ))}
                                      </tr>
                                    )
                                  })
                                ) : (
                                  <tr>
                                    <td
                                      colSpan={
                                        selectLabels.length + uniqueBreakpoints.length
                                      }
                                      className="px-2 py-4 text-muted-foreground"
                                    >
                                      Bez cien pre túto maticu.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Uloží sa celá matica naraz.</span>
                            <Button size="sm" variant="outline" type="submit">
                              Uložiť maticu
                            </Button>
                          </div>
                        </form>
                      </div>
                    </details>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Zatiaľ tu nie sú žiadne matice cien.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
