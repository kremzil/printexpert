"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { MessageSquare, ShoppingCart } from "lucide-react"

import { ModeButton } from "@/components/print/mode-button"
import { PriceDisplay } from "@/components/print/price-display"
import type { CustomerMode } from "@/components/print/types"
import { Badge } from "@/components/ui/badge"
import {
  isQuoteRequestItem,
  QUOTE_REQUEST_UPDATED_EVENT,
  upsertQuoteRequestItem,
} from "@/lib/quote-request-store"

type Props = {
  product: {
    slug: string
    name: string
    excerpt?: string | null
    description?: string | null
    priceFrom?: string | null
    priceAfterDiscountFrom?: string | null
    images?: Array<{
      url: string
      alt?: string | null
    }>
    isTopProduct?: boolean
  }
  mode?: CustomerMode
}

export function ProductCard({ product, mode = "b2c" }: Props) {
  const primaryImage = product.images?.[0]
  const [isInQuoteList, setIsInQuoteList] = useState(false)

  const imageAlt = primaryImage?.alt ?? product.name

  useEffect(() => {
    if (mode !== "b2b") return

    const sync = () => {
      setIsInQuoteList(isQuoteRequestItem(product.slug))
    }

    sync()
    window.addEventListener(QUOTE_REQUEST_UPDATED_EVENT, sync)
    window.addEventListener("storage", sync)

    return () => {
      window.removeEventListener(QUOTE_REQUEST_UPDATED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [mode, product.slug])

  const shortDescription =
    product.excerpt ||
    (product.description
      ? `${String(product.description).slice(0, 160).trim()}${
          String(product.description).length > 160 ? "…" : ""
        }`
      : "")

  const basePriceValue = Number(product.priceFrom)
  const discountPriceValue = Number(product.priceAfterDiscountFrom)
  const hasBasePrice = Number.isFinite(basePriceValue) && basePriceValue > 0
  const hasDiscountPrice =
    Number.isFinite(discountPriceValue) && discountPriceValue > 0
  const hasDiscount =
    hasBasePrice && hasDiscountPrice && discountPriceValue < basePriceValue
  const discountPercent = hasDiscount
    ? Math.round(((basePriceValue - discountPriceValue) / basePriceValue) * 100)
    : 0
  const finalPrice = hasDiscount ? discountPriceValue : basePriceValue
  const hasPrice = Number.isFinite(finalPrice) && finalPrice > 0

  const handleQuoteRequestAdd = () => {
    upsertQuoteRequestItem({
      slug: product.slug,
      name: product.name,
      imageUrl: primaryImage?.url ?? "",
      imageAlt,
      addedAt: new Date().toISOString(),
    })
    setIsInQuoteList(true)
    window.dispatchEvent(new Event(QUOTE_REQUEST_UPDATED_EVENT))
  }

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.isTopProduct ? (
          <Badge className="absolute left-3 top-3 z-10 bg-green-100 text-green-700">
            NAJPREDÁVANEJŠIE
          </Badge>
        ) : null}
        {hasDiscount && discountPercent > 0 ? (
          <Badge className="absolute right-3 top-3 z-10 bg-red-100 text-red-700">
            ZĽAVA -{discountPercent}%
          </Badge>
        ) : null}
        {primaryImage?.url ? (
          <Image
            src={primaryImage.url}
            alt={imageAlt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Bez obrázka
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <h3 className="mb-1 line-clamp-2 font-semibold">{product.name}</h3>
          {shortDescription && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {shortDescription}
            </p>
          )}
        </div>

        <div className="mt-auto">
          {hasPrice ? (
            <PriceDisplay
              price={finalPrice}
              oldPrice={hasDiscount ? basePriceValue : undefined}
              mode={mode}
              size="md"
              showFrom
            />
          ) : (
            <div className="text-sm text-muted-foreground">Na vyžiadanie</div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {mode === "b2c" ? (
            <ModeButton
              asChild
              mode={mode}
              variant="primary"
              size="md"
              className="flex-1"
            >
              <Link href={`/product/${product.slug}`}>
                <ShoppingCart className="h-4 w-4" />
                Kúpiť
              </Link>
            </ModeButton>
          ) : (
            <>
              <ModeButton
                mode={mode}
                variant={isInQuoteList ? "secondary" : "outline"}
                size="md"
                className="flex-1"
                type="button"
                onClick={handleQuoteRequestAdd}
              >
                <MessageSquare className="h-4 w-4" />
                {isInQuoteList ? "V zozname" : "Cenová ponuka"}
              </ModeButton>
              <ModeButton
                asChild
                mode={mode}
                variant="primary"
                size="md"
                className="flex-1"
              >
                <Link href={`/product/${product.slug}`}>
                  Konfigurovať
                </Link>
              </ModeButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductCard
