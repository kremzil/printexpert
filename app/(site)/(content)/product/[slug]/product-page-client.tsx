"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  ChevronRight,
  Facebook,
  Home,
  Linkedin,
  Mail,
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
import { LoginDialog } from "@/components/auth/login-dialog"
import { toast } from "sonner"
import {
  QUOTE_REQUEST_UPDATED_EVENT,
  upsertQuoteRequestItem,
} from "@/lib/quote-request-store"

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
    slug: string
    name: string
    excerptHtml?: string | null
    descriptionHtml?: string | null
    images: Array<{ url: string; alt?: string | null }>
    isTopProduct?: boolean
  }
  designerConfig?: DesignerConfig
  isLoggedIn?: boolean
}

declare global {
  interface Window {
    __pendingOrderUpload?: { file: File }
    __pendingDesignPdf?: { file: File }
  }
}

function StaticBadge() {
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      Statická ukážka
    </Badge>
  )
}

type ShareTarget = "facebook" | "x" | "linkedin" | "mail"

const toPlainText = (value?: string | null) =>
  value ? value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null

const normalizeShareText = (value: string) => value.replace(/\s+/g, " ").trim()
const clampShareText = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value

function ProductShareButtons({
  productName,
  shortDescription,
  imageUrl,
  quantity,
  summaryItems,
  price,
}: {
  productName: string
  shortDescription?: string | null
  imageUrl?: string | null
  quantity: number
  summaryItems: Array<{ label: string; value: string }>
  price: number | null
}) {
  const shareProduct = (target: ShareTarget) => {
    if (typeof window === "undefined") {
      return
    }

    const pageUrl = new URL(window.location.href)
    const imageAbsoluteUrl = imageUrl
      ? new URL(imageUrl, window.location.origin).toString()
      : null
    const descriptionText = normalizeShareText(toPlainText(shortDescription) ?? "")
    const shareTitle = clampShareText(normalizeShareText(productName), 120)
    const shareDescription = descriptionText
      ? clampShareText(descriptionText, 180)
      : ""
    const configurationText = [
      `Množstvo: ${quantity} ks`,
      ...summaryItems.map((item) => `${item.label}: ${item.value}`),
    ].join("; ")
    const shareConfiguration = clampShareText(
      normalizeShareText(configurationText),
      220
    )
    const priceText =
      price === null
        ? "Cena: podľa konfigurácie"
        : `Cena: ${new Intl.NumberFormat("sk-SK", {
            style: "currency",
            currency: "EUR",
          }).format(price)}`
    const sharePrice = clampShareText(normalizeShareText(priceText), 80)

    pageUrl.searchParams.set("st", shareTitle)
    if (shareDescription) {
      pageUrl.searchParams.set("sd", shareDescription)
    } else {
      pageUrl.searchParams.delete("sd")
    }
    pageUrl.searchParams.set("sc", shareConfiguration)
    pageUrl.searchParams.set("sp", sharePrice)
    if (imageAbsoluteUrl) {
      pageUrl.searchParams.set("si", imageAbsoluteUrl)
    } else {
      pageUrl.searchParams.delete("si")
    }
    const sharePageUrl = pageUrl.toString()
    const shareDetails = [
      `Názov: ${shareTitle}`,
      shareDescription ? `Popis: ${shareDescription}` : null,
      `Konfigurácia: ${shareConfiguration}`,
      sharePrice,
      imageAbsoluteUrl ? `Obrázok: ${imageAbsoluteUrl}` : null,
    ].filter((value): value is string => Boolean(value))

    const socialText = shareDetails.join(" | ")
    const encodedUrl = encodeURIComponent(sharePageUrl)
    const encodedName = encodeURIComponent(shareTitle)
    const encodedText = encodeURIComponent(socialText)

    let shareUrl = ""
    if (target === "facebook") {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`
    }
    if (target === "x") {
      shareUrl = `https://x.com/intent/post?url=${encodedUrl}&text=${encodedText}`
    }
    if (target === "linkedin") {
      shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    }
    if (target === "mail") {
      const mailBody = encodeURIComponent(
        `${shareDetails.join("\n")}\nURL: ${sharePageUrl}`
      )
      shareUrl = `mailto:?subject=${encodedName}&body=${mailBody}`
      window.location.href = shareUrl
      return
    }

    window.open(shareUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="icon"
        aria-label="Zdieľať na Facebooku"
        title="Facebook"
        className="border-transparent bg-[#1877F2] text-white hover:bg-[#166FE5]"
        onClick={() => shareProduct("facebook")}
      >
        <Facebook className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        aria-label="Zdieľať na X"
        title="X"
        className="border-transparent bg-black text-white hover:bg-neutral-800"
        onClick={() => shareProduct("x")}
      >
        <span className="text-sm font-semibold leading-none">X</span>
      </Button>
      <Button
        type="button"
        size="icon"
        aria-label="Zdieľať na LinkedIn"
        title="LinkedIn"
        className="border-transparent bg-[#0A66C2] text-white hover:bg-[#095AAE]"
        onClick={() => shareProduct("linkedin")}
      >
        <Linkedin className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        aria-label="Zdieľať e-mailom"
        title="Mail"
        className="border-transparent bg-[#EA4335] text-white hover:bg-[#D73A2D]"
        onClick={() => shareProduct("mail")}
      >
        <Mail className="h-4 w-4" />
      </Button>
    </div>
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
  designThumbnail,
  isLoggedIn,
  showFloatingBar,
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
  designThumbnail?: string | null
  isLoggedIn?: boolean
  showFloatingBar: boolean
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
    productionSpeedOptions,
    productionSpeedId,
    setProductionSpeedId,
    productionLeadTimeLabel,
    shipmentDateLabel,
    shipmentDateText,
    hasUnavailable,
    summaryItems,
    quantityPresets,
    getTotalForQuantity,
    addToCart,
    isAddingToCart,
    serverError,
  } = useWpConfigurator({ data, productId, designData })

  const elementCount = Array.isArray(designData) ? (designData as unknown[]).length : 0
  const hasDesignData = Boolean(designData)
  const topShareRef = useRef<HTMLDivElement | null>(null)
  const [isTopShareVisible, setIsTopShareVisible] = useState(true)

  useEffect(() => {
    const target = topShareRef.current
    if (!target) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsTopShareVisible(entry.isIntersecting)
      },
      { threshold: 0.05 }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  const handleAddQuoteRequest = () => {
    if (mode !== "b2b" || hasUnavailable || total === null) {
      return
    }

    const dimensions =
      width !== null && height !== null ? `${width} × ${height} ${dimUnit}` : null

    upsertQuoteRequestItem({
      slug: product.slug,
      name: product.name,
      imageUrl: product.images[0]?.url ?? "",
      imageAlt: product.images[0]?.alt ?? product.name,
      addedAt: new Date().toISOString(),
      configuration: {
        quantity,
        dimensions,
        options: summaryItems,
        totalPrice: total,
      },
    })
    window.dispatchEvent(new Event(QUOTE_REQUEST_UPDATED_EVENT))
    toast.success("Produkt bol pridaný do dopytu", {
      description: "Konfigurácia je uložená v zozname cenovej ponuky.",
    })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-8 lg:col-span-2">
        <div ref={topShareRef}>
          <ProductShareButtons
            productName={product.name}
            shortDescription={product.excerptHtml}
            imageUrl={product.images[0]?.url ?? null}
            quantity={quantity}
            summaryItems={summaryItems}
            price={total}
          />
        </div>
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

              <ConfiguratorOption
                mode={mode}
                label="Rýchlosť výroby"
                selected={productionSpeedId}
                onSelect={(value) =>
                  setProductionSpeedId(value as "standard" | "accelerated")
                }
                options={productionSpeedOptions.map((option) => ({
                  id: option.id,
                  label: option.label,
                  recommended: option.id === "standard",
                }))}
              />
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
                  {hasDesignData
                    ? `Dizajn pripravený (${elementCount} ${elementCount === 1 ? "element" : "elementov"}) — bude priložený k objednávke`
                    : "Vytvorte si vlastný dizajn priamo v prehliadači"}
                </p>
              </div>
              <Button
                onClick={isLoggedIn ? onOpenDesigner : undefined}
                variant={hasDesignData ? "outline" : "default"}
                className={hasDesignData
                  ? "border-purple-300 text-purple-700 hover:bg-purple-50"
                  : "bg-linear-to-r from-purple-600 to-pink-600 text-white shadow-md hover:from-purple-700 hover:to-pink-700"}
                asChild={!isLoggedIn}
              >
                {isLoggedIn ? (
                  <>
                    <Paintbrush className="mr-2 h-4 w-4" />
                    {hasDesignData ? "Upraviť dizajn" : "Otvoriť dizajnér"}
                  </>
                ) : (
                  <LoginDialog
                    trigger={
                      <button
                        type="button"
                        className="inline-flex items-center gap-2"
                        onClick={() => {
                          toast.info("Design Studio je dostupné len pre prihlásených používateľov", {
                            description: "Prihláste sa alebo si vytvorte účet, aby ste mohli používať dizajnér.",
                          })
                        }}
                      >
                        <Paintbrush className="h-4 w-4" />
                        {hasDesignData ? "Upraviť dizajn" : "Otvoriť dizajnér"}
                      </button>
                    }
                  />
                )}
              </Button>
            </div>
            {/* Design thumbnail preview */}
            {hasDesignData && designThumbnail && (
              <div className="mt-4 overflow-hidden rounded-lg border border-purple-200 bg-white">
                <img
                  src={designThumbnail}
                  alt="Náhľad dizajnu"
                  className="h-auto w-full max-h-48 object-contain"
                />
              </div>
            )}
          </Card>
        )}

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
          onAddQuoteRequest={handleAddQuoteRequest}
          isQuoteRequestDisabled={hasUnavailable || total === null}
          leadTimeLabel={productionLeadTimeLabel}
          shipmentDateLabel={shipmentDateLabel}
          shipmentDateText={shipmentDateText}
          showFloatingBar={showFloatingBar}
          shareSection={
            isTopShareVisible ? null : (
              <ProductShareButtons
                productName={product.name}
                shortDescription={product.excerptHtml}
                imageUrl={product.images[0]?.url ?? null}
                quantity={quantity}
                summaryItems={summaryItems}
                price={total}
              />
            )
          }
        />
      </div>

      <div className="lg:col-span-2">
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
  isLoggedIn,
}: ProductPageClientProps) {
  const [fileStatus, setFileStatus] = useState<"idle" | "success">("idle")
  const [fileStatusMessage, setFileStatusMessage] = useState<string | undefined>(
    undefined
  )
  const [showDesigner, setShowDesigner] = useState(false)
  const [designData, setDesignData] = useState<unknown>(null)
  const [designThumbnail, setDesignThumbnail] = useState<string | null>(null)
  const productTitleRef = useRef<HTMLHeadingElement | null>(null)
  const [showFloatingBar, setShowFloatingBar] = useState(false)

  useEffect(() => {
    const target = productTitleRef.current
    if (!target) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingBar(!entry.isIntersecting)
      },
      {
        threshold: 0,
        rootMargin: "-64px 0px 0px 0px",
      }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [])

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
            {product.isTopProduct ? (
              <Badge className="bg-green-100 text-green-700">
                NAJPREDÁVANEJŠIE
              </Badge>
            ) : null}
            <Badge variant="outline">Expedícia do 48h</Badge>
            {mode === "b2b" && <Badge variant="outline">B2B ceny</Badge>}
          </div>
          <h1 ref={productTitleRef} className="mb-2 text-3xl font-bold md:text-4xl">
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
            designThumbnail={designThumbnail}
            isLoggedIn={isLoggedIn}
            showFloatingBar={showFloatingBar}
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

      {/* Design Studio Fullscreen Modal — rendered via portal to escape header stacking context */}
      {showDesigner && designerConfig?.enabled && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-background">
          <DesignEditor
            width={designerConfig.width}
            height={designerConfig.height}
            bgColor={designerConfig.bgColor}
            dpi={designerConfig.dpi}
            colorProfile={designerConfig.colorProfile}
            productLabel={product.name}
            initialElements={Array.isArray(designData) ? designData as DesignElement[] : undefined}
            onClose={() => setShowDesigner(false)}
            onSave={(elements, thumbnailDataUrl, pdfBlob) => {
              setDesignData(elements)
              setDesignThumbnail(thumbnailDataUrl ?? null)
              setShowDesigner(false)

              // Store generated PDF for upload during checkout
              if (pdfBlob) {
                const pdfFile = new File(
                  [pdfBlob],
                  `design-${product.name.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`,
                  { type: "application/pdf" }
                )
                window.__pendingDesignPdf = { file: pdfFile }
              }

              toast.success(
                `Dizajn priložený k objednávke (${elements.length} ${elements.length === 1 ? "element" : "elementov"})`,
                { description: "PDF dizajnu sa automaticky priloží k objednávke." }
              )
            }}
          />
        </div>,
        document.body
      )}
    </div>
  )
}
