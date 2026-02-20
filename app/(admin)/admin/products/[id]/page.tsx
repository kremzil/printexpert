import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Badge } from "@/components/ui/badge"
import { AdminButton as Button } from "@/components/admin/admin-button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDeleteForm } from "@/components/admin/confirm-delete-form"
import { MatrixVisibilitySwitch } from "@/components/admin/matrix-visibility-switch"
import { ProductDescriptionEditor } from "@/components/admin/product-description-editor"
import { ProductImagesEditor } from "@/components/admin/product-images-editor"
import { ProductDesignerSettings } from "@/components/admin/product-designer-settings"
import { DesignCanvasProfilesManager } from "@/components/admin/design-canvas-profiles-manager"
import { ProductMatrixDialog } from "@/components/admin/product-matrix-dialog"
import { ProductTitleEditor } from "@/components/admin/product-title-editor"
import { FormSubmitButton } from "@/components/admin/form-submit-button"
import { getAdminProductById } from "@/lib/catalog"
import { getPrisma } from "@/lib/prisma"
import { getWpCalculatorData } from "@/lib/wp-calculator"
import { requireAdmin } from "@/lib/auth-helpers"
import {
  copyMatrixFromProduct,
  createMatrix,
  createMatrixPriceRows,
  deleteMatrix,
  updateProductDetails,
  updateProductWpId,
  updateMatrix,
  updateMatrixPrices,
  updateMatrixVisibility,
} from "./actions"

type AdminProductPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    tab?: string | string[]
  }>
}

type ProductTab = "basic" | "prices" | "gallery" | "seo" | "design"

const PRODUCT_TABS: Array<{ id: ProductTab; label: string }> = [
  { id: "basic", label: "Základné info" },
  { id: "prices", label: "Ceny (Matice)" },
  { id: "gallery", label: "Galéria" },
  { id: "seo", label: "SEO" },
  { id: "design", label: "Design Studio" },
]

function resolveProductTab(rawTab: string | undefined): ProductTab {
  if (!rawTab) return "basic"
  return PRODUCT_TABS.some((tab) => tab.id === rawTab) ? (rawTab as ProductTab) : "basic"
}

async function getAttributesWithTerms() {
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
  const [terms, termMeta] = await Promise.all([
    termIds.length
      ? prisma.wpTerm.findMany({
          where: { termId: { in: termIds } },
          orderBy: [{ name: "asc" }],
        })
      : [],
    termIds.length
      ? prisma.wpTermMeta.findMany({
          where: { termId: { in: termIds }, metaKey: { startsWith: "order" } },
        })
      : [],
  ])

  return { attributes, termTaxonomies, terms, termMeta }
}

async function getCategories() {
  const prisma = getPrisma()
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  })
}

export default async function AdminProductPage({
  params,
  searchParams,
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
      <AdminProductDetails paramsPromise={params} searchParamsPromise={searchParams} />
    </Suspense>
  )
}

async function AdminProductDetails({
  paramsPromise,
  searchParamsPromise,
}: {
  paramsPromise: AdminProductPageProps["params"]
  searchParamsPromise: AdminProductPageProps["searchParams"]
}) {
  await requireAdmin()

  const [{ id }, rawSearchParams] = await Promise.all([paramsPromise, searchParamsPromise])
  const tabParam = Array.isArray(rawSearchParams.tab) ? rawSearchParams.tab[0] : rawSearchParams.tab
  const activeTab = resolveProductTab(tabParam)

  const [product, attributeData, categories] = await Promise.all([
    getAdminProductById(id),
    getAttributesWithTerms(),
    getCategories(),
  ])

  if (!product) {
    notFound()
  }

  const prisma = getPrisma()
  const [calculatorData, sourceMatrixCandidates] = await Promise.all([
    product.wpProductId
      ? getWpCalculatorData(product.wpProductId, true)
      : Promise.resolve(null),
    product.wpProductId
      ? prisma.wpMatrixType.findMany({
          where: { productId: { not: product.wpProductId } },
          orderBy: [{ productId: "asc" }, { sorder: "asc" }, { mtypeId: "asc" }],
          select: {
            mtypeId: true,
            productId: true,
            mtype: true,
            title: true,
          },
        })
      : Promise.resolve([]),
  ])
  const sourceWpProductIds = Array.from(
    new Set(sourceMatrixCandidates.map((matrix) => matrix.productId))
  )
  const sourceProductsByWpId = sourceWpProductIds.length
    ? await prisma.product.findMany({
        where: { wpProductId: { in: sourceWpProductIds } },
        orderBy: { name: "asc" },
        select: {
          wpProductId: true,
          name: true,
        },
      })
    : []
  const sourceProductNameByWpId = new Map<number, string>()
  sourceProductsByWpId.forEach((sourceProduct) => {
    if (sourceProduct.wpProductId === null) return
    if (!sourceProductNameByWpId.has(sourceProduct.wpProductId)) {
      sourceProductNameByWpId.set(sourceProduct.wpProductId, sourceProduct.name)
    }
  })
  const baseMatrix =
    calculatorData?.matrices.find((matrix) => matrix.kind === "simple") ?? null
  const baseSelects = baseMatrix?.selects ?? []
  const sizeSelect =
    baseMatrix?.selects.find((select) => select.class.includes("smatrix-size")) ?? null
  const designerSizeOptions = sizeSelect
    ? sizeSelect.options.map((option) => ({
        aid: sizeSelect.aid,
        termId: option.value,
        label: option.label,
      }))
    : []
  const ntpLabelByValue: Record<string, string> = {
    "0": "Fixná",
    "2": "Plocha (šírka × výška)",
    "3": "Obvod",
    "4": "Šírka × 2",
  }
  const numStyleLabelByValue: Record<string, string> = {
    "0": "Vstup",
    "1": "Zoznam",
  }
  const normalizedDesignCanvasProfiles = (product.designCanvasProfiles ?? []).map(
    (profile) => ({
      ...profile,
      trimWidthMm: Number(profile.trimWidthMm),
      trimHeightMm: Number(profile.trimHeightMm),
      bleedTopMm: Number(profile.bleedTopMm),
      bleedRightMm: Number(profile.bleedRightMm),
      bleedBottomMm: Number(profile.bleedBottomMm),
      bleedLeftMm: Number(profile.bleedLeftMm),
      safeTopMm: Number(profile.safeTopMm),
      safeRightMm: Number(profile.safeRightMm),
      safeBottomMm: Number(profile.safeBottomMm),
      safeLeftMm: Number(profile.safeLeftMm),
      templates: (profile.templates ?? []).map((template) => ({
        id: template.id,
        productId: template.productId,
        canvasProfileId: template.canvasProfileId,
        name: template.name,
        elements: template.elements as unknown,
        thumbnailUrl: template.thumbnailUrl,
        isDefault: template.isDefault,
        sortOrder: template.sortOrder,
      })),
    })
  )
  const { attributes, termTaxonomies, terms, termMeta } = attributeData
  const termById = new Map(terms.map((term) => [term.termId, term]))
  const termOrderByKey = new Map<string, number>()
  const parseOrder = (value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  termMeta.forEach((row) => {
    const order = parseOrder(row.metaValue)
    if (order === null) return
    termOrderByKey.set(`${row.termId}:${row.metaKey}`, order)
  })
  const getTermOrder = (termId: number, attributeName?: string | null) => {
    if (attributeName) {
      const key = `${termId}:order_pa_${attributeName}`
      const value = termOrderByKey.get(key)
      if (value !== undefined) {
        return value
      }
    }
    return termOrderByKey.get(`${termId}:order`) ?? null
  }
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
      .sort((a, b) => {
        const orderA = getTermOrder(a.termId, attribute.attributeName)
        const orderB = getTermOrder(b.termId, attribute.attributeName)
        const resolvedA = orderA ?? Number.MAX_SAFE_INTEGER
        const resolvedB = orderB ?? Number.MAX_SAFE_INTEGER
        if (resolvedA !== resolvedB) {
          return resolvedA - resolvedB
        }
        return a.name.localeCompare(b.name)
      })
    return {
      attribute,
      taxonomy,
      terms: attributeTerms,
    }
  })
  const seoDescriptionPreview = (product.excerpt ?? product.description ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return (
    <section className="space-y-6">
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Detail produktu
            </div>
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <div className="text-sm text-muted-foreground">ID: {product.id}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={product.isActive ? "default" : "secondary"}>
              {product.isActive ? "Aktívny" : "Neaktívny"}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/products">Späť na produkty</Link>
            </Button>
          </div>
        </div>
        <nav className="flex min-w-max flex-wrap items-center gap-1 rounded-lg border bg-muted/20 p-1">
          {PRODUCT_TABS.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <Link
                key={tab.id}
                href={`/admin/products/${product.id}?tab=${tab.id}`}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {activeTab === "basic" || activeTab === "gallery" || activeTab === "design" || activeTab === "seo" ? (
      <Card>
        <CardContent className="space-y-6 py-6">
          <form
            action={updateProductDetails.bind(null, { productId: product.id })}
            className="space-y-6"
          >
            {activeTab === "basic" ? (
              <>
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                  <div className="space-y-5">
                    <ProductTitleEditor
                      initialName={product.name}
                      initialSlug={product.slug}
                    />
                    <ProductDescriptionEditor
                      name="excerpt"
                      label="Krátky popis"
                      initialValue={product.excerpt ?? ""}
                      placeholder="Začnite písať krátky popis..."
                    />
                    <ProductDescriptionEditor
                      name="description"
                      initialValue={product.description ?? ""}
                      placeholder="Začnite písať popis..."
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2 rounded-lg border p-4">
                      <Label>Stav a Viditeľnosť</Label>
                      <div className="space-y-3">
                        <label className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium">Aktívny produkt</span>
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              name="isActive"
                              value="1"
                              defaultChecked={product.isActive}
                              className="h-4 w-4 rounded border-input accent-primary"
                            />
                            <input type="hidden" name="isActive" value="0" />
                          </span>
                        </label>
                        <label className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                          <span>Zobraziť v B2B</span>
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              name="showInB2b"
                              value="1"
                              defaultChecked={product.showInB2b}
                              className="h-4 w-4 rounded border-input accent-primary"
                            />
                            <input type="hidden" name="showInB2b" value="0" />
                          </span>
                        </label>
                        <label className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                          <span>Zobraziť v B2C</span>
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              name="showInB2c"
                              value="1"
                              defaultChecked={product.showInB2c}
                              className="h-4 w-4 rounded border-input accent-primary"
                            />
                            <input type="hidden" name="showInB2c" value="0" />
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-lg border p-4">
                      <Label htmlFor="category">Kategória</Label>
                      <select
                        id="category"
                        name="categoryId"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        defaultValue={product.categoryId}
                      >
                        <option value="">-- Bez kategórie --</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="space-y-2">
                        <Label htmlFor="priceFrom">Cena od</Label>
                        <Input
                          id="priceFrom"
                          name="priceFrom"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          defaultValue={product.priceFrom?.toString() ?? ""}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priceAfterDiscountFrom">Cena po zľave od</Label>
                        <Input
                          id="priceAfterDiscountFrom"
                          name="priceAfterDiscountFrom"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          defaultValue={product.priceAfterDiscountFrom?.toString() ?? ""}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        DPH sa nastavuje globálne v Nastavenia &gt; Obchod.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Uložte zmeny pre aktualizáciu produktu.</span>
                  <FormSubmitButton variant="secondary" size="sm" pendingText="Ukladám zmeny...">
                    Uložiť zmeny
                  </FormSubmitButton>
                </div>
              </>
            ) : null}

            {activeTab === "gallery" ? (
              <ProductImagesEditor
                productId={product.id}
                images={product.images}
              />
            ) : null}

            {activeTab === "design" ? (
              <>
                <ProductDesignerSettings
                  designerEnabled={product.designerEnabled ?? false}
                />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Uložte nastavenia pre Design Studio.</span>
                  <FormSubmitButton variant="secondary" size="sm" pendingText="Ukladám nastavenia...">
                    Uložiť nastavenia
                  </FormSubmitButton>
                </div>
              </>
            ) : null}

            {activeTab === "seo" ? (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">SEO náhľad</h2>
                  <p className="text-sm text-muted-foreground">
                    Samostatné SEO polia doplníme v ďalšom kroku.
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Title</span>
                    <div className="font-medium">{product.name}</div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">URL</span>
                    <div className="text-muted-foreground">/product/{product.slug}</div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Description</span>
                    <div className="text-muted-foreground">{seoDescriptionPreview || "Bez popisu"}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>
      ) : null}

      {activeTab === "design" && product.designerEnabled && (
        <Card>
          <CardContent className="py-6">
            <DesignCanvasProfilesManager
              productId={product.id}
              profiles={normalizedDesignCanvasProfiles}
              sizeOptions={designerSizeOptions}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "prices" ? (
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
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Nové matice pridávajte cez výber vlastností.
                </div>
                <ProductMatrixDialog
                  productName={product.name}
                  attributes={attributesWithTerms}
                  submitAction={createMatrix.bind(null, {
                    productId: product.id,
                    wpProductId: product.wpProductId,
                  })}
                />
              </div>
              {sourceMatrixCandidates.length > 0 ? (
                <form
                  action={copyMatrixFromProduct.bind(null, {
                    productId: product.id,
                    wpProductId: product.wpProductId,
                  })}
                  className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
                >
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium">Kópia matice z iného produktu</h3>
                      <p className="text-xs text-muted-foreground">
                        Vyberte zdrojovú maticu a skopírujte ju do aktuálneho produktu.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sourceMtypeId">Zdrojová matica</Label>
                      <select
                        id="sourceMtypeId"
                        name="sourceMtypeId"
                        defaultValue=""
                        required
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="" disabled>
                          Vyberte maticu z iného produktu
                        </option>
                        {sourceMatrixCandidates.map((matrix) => {
                          const sourceName =
                            sourceProductNameByWpId.get(matrix.productId) ??
                            `WP produkt ${matrix.productId}`
                          const matrixKind =
                            matrix.mtype === 1 ? "Dokončovacia" : "Základná"
                          const matrixTitle =
                            matrix.title?.trim() || `Matica ${matrix.mtypeId}`
                          return (
                            <option key={matrix.mtypeId} value={matrix.mtypeId}>
                              {`${sourceName} (WP ${matrix.productId}) • ${matrixKind} • ${matrixTitle}`}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        name="copyPrices"
                        value="1"
                        defaultChecked
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      <input type="hidden" name="copyPrices" value="0" />
                      Skopírovať aj ceny
                    </label>
                  </div>
                  <FormSubmitButton
                    size="sm"
                    pendingText="Kopírujem maticu..."
                  >
                    Skopírovať maticu
                  </FormSubmitButton>
                </form>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Zatiaľ nie je dostupná žiadna matica z iného produktu.
                </div>
              )}
            </div>
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
                  const numStyleLabel =
                    numStyleLabelByValue[matrix.numStyle ?? "0"] ??
                    `Štýl ${matrix.numStyle ?? "0"}`
                  const aUnitLabel = matrix.aUnit ?? "cm2"
                  const kindLabel =
                    matrix.kind === "finishing" ? "Dokončovacia" : "Základná"
                  const uniqueBreakpoints = Array.from(
                    new Set(matrix.prices.map((row) => row.breakpoint))
                  ).sort((a, b) => a - b)
                  const displaySelects =
                    matrix.kind === "finishing" && baseSelects.length > 0
                      ? [
                          ...baseSelects,
                          ...matrix.selects.filter(
                            (select) =>
                              !baseSelects.some(
                                (baseSelect) => baseSelect.aid === select.aid
                              )
                          ),
                        ]
                      : matrix.selects
                  const selectLabels = displaySelects.map((select) => ({
                    aid: select.aid,
                    label: select.label,
                  }))
                  const editSlots = matrix.selects.map((select) => ({
                    attributeId: Number(select.aid),
                    termIds: select.options
                      .map((option) => Number(option.value))
                      .filter((value) => !Number.isNaN(value)),
                  }))
                  const editNumbers = breakpoints ?? ""

                  const rowsByCombo = new Map<
                    string,
                    {
                      aterms: string
                      terms: Record<string, string>
                      prices: Record<string, string>
                    }
                  >()

                  for (const row of matrix.prices) {
                    const key = row.aterms
                    const existing = rowsByCombo.get(key)
                    if (existing) {
                      existing.prices[String(row.breakpoint)] = row.price
                    } else {
                      rowsByCombo.set(key, {
                        aterms: row.aterms,
                        terms: row.terms,
                        prices: {
                          [String(row.breakpoint)]: row.price,
                        },
                      })
                    }
                  }

                  return (
                    <details key={matrix.mtid} className="rounded-lg border">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-sm">
                        <Badge variant="secondary">{kindLabel}</Badge>
                        <span className="font-medium">
                          {matrix.title ?? `Matica ${matrix.mtid}`}
                        </span>
                        <span className="text-muted-foreground">
                          Typ množstva: {ntpLabel}
                        </span>
                        <span className="text-muted-foreground">
                          Štýl množstva: {numStyleLabel}
                        </span>
                        <span className="text-muted-foreground">
                          Jednotka plochy: {aUnitLabel}
                        </span>
                        <span className="text-muted-foreground">
                          Cenníkové položky: {matrix.prices.length}
                        </span>
                      </summary>
                      <div className="space-y-4 border-t px-4 py-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="text-muted-foreground">
                              Breakpointy:{" "}
                              {breakpoints ? breakpoints : "Nezadané"}
                            </div>
                            <MatrixVisibilitySwitch
                              checked={matrix.isActive}
                              action={updateMatrixVisibility.bind(null, {
                                productId: product.id,
                                mtypeId: Number(matrix.mtid),
                              })}
                            />
                          </div>
                          {matrix.prices.length === 0 ? (
                            <form
                              action={createMatrixPriceRows.bind(null, {
                                productId: product.id,
                                mtypeId: Number(matrix.mtid),
                              })}
                            >
                              <Button size="sm" variant="outline" type="submit">
                                Vygenerovať ceny
                              </Button>
                            </form>
                          ) : null}
                          <div className="flex flex-col items-start gap-2 sm:items-end">
                            <ProductMatrixDialog
                              productName={product.name}
                              attributes={attributesWithTerms}
                              submitAction={updateMatrix.bind(null, {
                                productId: product.id,
                                mtypeId: Number(matrix.mtid),
                              })}
                              triggerLabel="Upraviť maticu"
                              dialogTitle="Upraviť maticu"
                              triggerVariant="outline"
                              triggerSize="sm"
                              initialValues={{
                                slots: editSlots,
                                kind: matrix.kind,
                                numType: matrix.ntp,
                                numStyle: matrix.numStyle ?? "0",
                                aUnit: matrix.aUnit ?? "cm2",
                                numbers: editNumbers,
                              }}
                            />
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
                        </div>
                        <div className="space-y-2">
                          {displaySelects.map((select) => (
                            <div
                              key={select.aid}
                              className="rounded-md bg-muted/30 px-3 py-2"
                            >
                              <div className="text-xs text-muted-foreground">
                                {select.label}
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
                          <div className="table-responsive rounded-lg border">
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
      ) : null}
    </section>
  )
}
