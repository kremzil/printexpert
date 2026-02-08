"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ChevronRight,
  Home,
  Package,
  Settings,
  Star,
  Paintbrush,
  Sparkles,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ConfiguratorOption } from "@/components/print/configurator-option"
import { FileUpload } from "@/components/print/file-upload"
import { QuantitySelector } from "@/components/print/quantity-selector"
import { TrustBlock } from "@/components/print/trust-block"
import { ProductCard } from "@/components/product/product-card"
import type { CustomerMode } from "@/components/print/types"
import { ProductGallery } from "@/components/product/product-gallery"
import {
  useWpConfigurator,
  type WpConfiguratorData,
} from "@/components/print/use-wp-configurator"
import { RealConfiguratorPanel } from "@/components/print/real-configurator-panel"
import { Button } from "@/components/ui/button"
import { DesignEditor, type DesignElement } from "@/components/print/design-editor"
import { toast } from "sonner"

export type DesignerConfig = {
  enabled: boolean
  width: number
  height: number
  bgColor: string
  dpi: number
  colorProfile: string
} | null

type ProductPageClientProps = {
  mode: CustomerMode
  productId: string
  calculatorData: WpConfiguratorData | null
  relatedProducts: Array<{
    id: string
    slug: string
    name: string
    excerpt?: string | null
    priceFrom?: string | null
    images: Array<{ url: string; alt?: string | null }>
  }>
  product: {
    name: string
    excerptHtml?: string | null
    descriptionHtml?: string | null
    images: Array<{ url: string; alt?: string | null }>
  }
  designerConfig?: DesignerConfig
}

declare global {
  interface Window {
    __pendingOrderUpload?: { file: File }
  }
}

function StaticBadge() {
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      Statická ukážka
    </Badge>
  )
}

function RealConfiguratorSection({
  mode,
  data,
  productId,
  product,
  fileStatus,
  fileStatusMessage,
  onFileSelect,
  designerConfig,
  onOpenDesigner,
  designData,
}: {
  mode: CustomerMode
  data: WpConfiguratorData
  productId: string
  product: ProductPageClientProps["product"]
  fileStatus: "idle" | "success"
  fileStatusMessage?: string
  onFileSelect: (files: FileList) => void
  designerConfig?: DesignerConfig
  onOpenDesigner?: () => void
  designData?: unknown
}) {
  const {
    selections,
    setSelections,
    quantity,
    setQuantity,
    width,
    height,
    setWidth,
    setHeight,
    minQuantity,
    minWidth,
    minHeight,
    dimUnit,
    hasAreaSizing,
    useQuantitySelect,
    visibleMatrices,
    total,
    hasUnavailable,
    summaryItems,
    quantityPresets,
    getTotalForQuantity,
    addToCart,
    isAddingToCart,
    serverError,
  } = useWpConfigurator({ data, productId, designData })

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-8 lg:col-span-2">
        <ProductGallery images={product.images} productName={product.name} />

        <Card className="p-6">
          <div className="mb-6 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h2 className="text-xl font-bold">Konfigurátor produktu</h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Množstvo</label>
                <QuantitySelector
                  mode={mode}
                  value={quantity}
                  onChange={setQuantity}
                  presets={quantityPresets}
                  usePresetsSelect={useQuantitySelect}
                  min={minQuantity}
                />
                {quantity < minQuantity && (
                  <p className="mt-2 text-xs text-destructive">
                    Minimálne množstvo: {minQuantity} ks.
                  </p>
                )}
              </div>

              {hasAreaSizing ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    Šírka ({dimUnit})
                    <input
                      type="number"
                      min={minWidth}
                      value={width ?? ""}
                      onChange={(event) =>
                        setWidth(
                          event.target.value === "" ? null : Number(event.target.value)
                        )
                      }
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Výška ({dimUnit})
                    <input
                      type="number"
                      min={minHeight}
                      value={height ?? ""}
                      onChange={(event) =>
                        setHeight(
                          event.target.value === "" ? null : Number(event.target.value)
                        )
                      }
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            {visibleMatrices.map((matrix) => (
              <div key={matrix.mtid} className="space-y-4">
                {matrix.selects.length === 0 ? (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Táto položka sa vypočíta automaticky.
                  </div>
                ) : (
                  matrix.selects.map((select) => (
                    <ConfiguratorOption
                      key={`${matrix.mtid}-${select.aid}`}
                      mode={mode}
                      label={select.label}
                      selected={selections[matrix.mtid]?.[select.aid]}
                      onSelect={(value) =>
                        setSelections((current) => ({
                          ...current,
                          [matrix.mtid]: {
                            ...(current[matrix.mtid] ?? {}),
                            [select.aid]: value,
                          },
                        }))
                      }
                      options={select.options.map((option) => ({
                        id: option.value,
                        label: option.label,
                        recommended: option.selected,
                      }))}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-6 flex items-center gap-2">
            <Package className="h-5 w-5" />
            <h2 className="text-xl font-bold">Nahrajte podklady</h2>
          </div>
          <FileUpload
            onFileSelect={onFileSelect}
            status={fileStatus}
            statusMessage={fileStatusMessage}
          />
        </Card>

        {/* Design Studio button — rendered via ProductPageClient below */}
        {designerConfig?.enabled && onOpenDesigner && (
          <Card className="overflow-hidden border-2 border-dashed border-purple-200 bg-linear-to-br from-purple-50/80 to-pink-50/60 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-r from-purple-500 to-pink-500 text-white shadow-md">
                <Paintbrush className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Design Studio</h3>
                  <span className="flex items-center gap-1 rounded-full bg-linear-to-r from-purple-500 to-pink-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    <Sparkles className="h-2.5 w-2.5" />
                    NOVO
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {designData
                    ? `Dizajn uložený (${Array.isArray(designData) ? (designData as unknown[]).length : 0} elementov)`
                    : "Vytvorte si vlastný dizajn priamo v prehliadači"}
                </p>
              </div>
              <Button
                onClick={onOpenDesigner}
                variant={designData ? "outline" : "default"}
                className={designData
                  ? "border-purple-300 text-purple-700 hover:bg-purple-50"
                  : "bg-linear-to-r from-purple-600 to-pink-600 text-white shadow-md hover:from-purple-700 hover:to-pink-700"}
              >
                <Paintbrush className="mr-2 h-4 w-4" />
                {designData ? "Upraviť dizajn" : "Otvoriť dizajnér"}
              </Button>
            </div>
          </Card>
        )}

        <Tabs defaultValue="specs" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="specs">Popis produktu</TabsTrigger>
            <TabsTrigger value="faq">Časté otázky</TabsTrigger>
          </TabsList>

          <TabsContent value="specs" className="mt-6">
       
            <Card className="p-6">
              {product.descriptionHtml ? (
                <div>
                  <div
                    className="prose prose-neutral max-w-none text-sm [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_hr]:my-4 [&_hr]:border-border [&_mark]:rounded [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:bg-amber-200 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-md [&_iframe]:border-0 [&_video]:w-full [&_video]:rounded-md"
                    dangerouslySetInnerHTML={{
                      __html: product.descriptionHtml,
                    }}
                  />
                </div>
              ) : null}
            </Card>
          </TabsContent>

          <TabsContent value="faq" className="mt-6">
            <div className="mb-3 flex justify-end">
              <StaticBadge />
            </div>
            <Accordion type="single" collapsible>
              <AccordionItem value="item-1">
                <AccordionTrigger>
                  Aké formáty súborov akceptujete?
                </AccordionTrigger>
                <AccordionContent>
                  Akceptujeme PDF, AI, EPS, INDD a PSD súbory. Odporúčame PDF s
                  vloženými fontami a CMYK farebným priestorom. Súbory by mali
                  mať minimálne 300 DPI rozlíšenie a 3mm spadávku.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Ako dlho trvá výroba?</AccordionTrigger>
                <AccordionContent>
                  Štandardná výroba trvá 2-3 pracovné dni od schválenia
                  podkladov. Pri prémiových materiáloch alebo špeciálnych
                  úpravách môže výroba trvať 3-4 dni. Expresné vyhotovenie za 24h
                  je možné za príplatok.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Kontrolujete súbory pred tlačou?</AccordionTrigger>
                <AccordionContent>
                  Áno, každý súbor prechádza kontrolou našim prepress tímom.
                  Skontrolujeme rozlíšenie, spadávku, farby, fonty a ďalšie
                  technické parametre. V prípade problémov vás kontaktujeme a
                  pomôžeme s úpravou súborov zadarmo.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>Aké sú možnosti doručenia?</AccordionTrigger>
                <AccordionContent>
                  Ponúkame doručenie kuriérom (1-2 dni po výrobe) alebo osobný
                  odber v Bratislave zadarmo. Pre B2B zákazníkov môžeme
                  zabezpečiť aj vlastnú dopravu pri väčších objemoch.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
        </Tabs>
      </div>

      <div className="lg:col-span-1">
        <RealConfiguratorPanel
          mode={mode}
          summaryItems={summaryItems}
          price={total}
          hasUnavailable={hasUnavailable}
          isAddingToCart={isAddingToCart}
          serverError={serverError}
          quantityPresets={quantityPresets}
          getTotalForQuantity={getTotalForQuantity}
          activeQuantity={quantity}
          onAddToCart={addToCart}
        />
      </div>
    </div>
  )
}

export function ProductPageClient({
  mode,
  productId,
  calculatorData,
  relatedProducts,
  product,
  designerConfig,
}: ProductPageClientProps) {
  const [fileStatus, setFileStatus] = useState<"idle" | "success">("idle")
  const [fileStatusMessage, setFileStatusMessage] = useState<string | undefined>(
    undefined
  )
  const [showDesigner, setShowDesigner] = useState(false)
  const [designData, setDesignData] = useState<unknown>(null)

  const handleFileSelect = (files: FileList) => {
    const file = files[0]
    if (!file) {
      return
    }
    window.__pendingOrderUpload = { file }
    setFileStatus("success")
    setFileStatusMessage(
      `Súbor ${file.name} bude priložený pri dokončení objednávky.`
    )
  }

  return (
    <div className="min-h-screen bg-background rounded-2xl shadow-2xl my-4 md:my-8">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6">
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/"
            className="inline-flex items-center hover:text-foreground"
            aria-label="Domov"
          >
            <Home className="h-4 w-4" />
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/catalog" className="hover:text-foreground">
            Produkty
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="bg-green-100 text-green-700">
              NAJPREDÁVANEJŠIE
            </Badge>
            <Badge variant="outline">Expedícia do 48h</Badge>
            {mode === "b2b" && <Badge variant="outline">B2B ceny</Badge>}
          </div>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">
            {product.name}
          </h1>
          {product.excerptHtml ? (
            <div
              className="max-w-3xl text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: product.excerptHtml }}
            />
          ) : (
            <p className="max-w-3xl text-muted-foreground">
              Profesionálny vzhľad, rýchla výroba a kontrola súborov v cene.
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              4.9 (247 hodnotení)
            </span>
          </div>
        </div>

        {calculatorData ? (
          <RealConfiguratorSection
            mode={mode}
            data={calculatorData}
            productId={productId}
            product={product}
            fileStatus={fileStatus}
            fileStatusMessage={fileStatusMessage}
            onFileSelect={handleFileSelect}
            designerConfig={designerConfig}
            onOpenDesigner={() => setShowDesigner(true)}
            designData={designData}
          />
        ) : null}
        <div className="my-12">
          <div className="mb-4 flex justify-end">
                  </div>
          <TrustBlock mode={mode} variant="detailed" />
        </div>

        <div className="my-12">
          <h2 className="mb-6 text-2xl font-bold">Súvisiace produkty</h2>
          {relatedProducts.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {relatedProducts.map((item) => (
                  <ProductCard
                    key={item.id}
                    mode={mode}
                    product={{
                      slug: item.slug,
                      name: item.name,
                      excerpt: item.excerpt ?? null,
                      priceFrom: item.priceFrom ?? null,
                      images: item.images ?? [],
                    }}
                  />
                ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background/60 p-6 text-sm text-muted-foreground">
              Momentálne nemáme ďalšie produkty v tejto kategórii.
            </div>
          )}
        </div>
      </div>

      {/* Design Studio Fullscreen Modal */}
      {showDesigner && designerConfig?.enabled && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <DesignEditor
            width={designerConfig.width}
            height={designerConfig.height}
            bgColor={designerConfig.bgColor}
            dpi={designerConfig.dpi}
            colorProfile={designerConfig.colorProfile}
            productLabel={product.name}
            initialElements={Array.isArray(designData) ? designData as DesignElement[] : undefined}
            onClose={() => setShowDesigner(false)}
            onSave={(elements) => {
              setDesignData(elements)
              setShowDesigner(false)
              toast.success(
                `Dizajn uložený (${elements.length} ${elements.length === 1 ? "element" : "elementov"})`,
                { description: "Dizajn bude priložený k objednávke pri pridaní do košíka." }
              )
            }}
          />
        </div>
      )}
    </div>
  )
}
