"use client"

import Image from "next/image"
import Link from "next/link"
import { MessageSquare, ShoppingCart } from "lucide-react"

import { ModeButton } from "@/components/print/mode-button"
import { PriceDisplay } from "@/components/print/price-display"
import type { CustomerMode } from "@/components/print/types"
import { Badge } from "@/components/ui/badge"

type Props = {
  product: {
    slug: string
    name: string
    excerpt?: string | null
    description?: string | null
    priceFrom?: string | null
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
  const shortDescription =
    product.excerpt ||
    (product.description
      ? `${String(product.description).slice(0, 160).trim()}${
          String(product.description).length > 160 ? "…" : ""
        }`
      : "")

  const priceValue = Number(product.priceFrom)
  const hasPrice = Number.isFinite(priceValue) && priceValue > 0

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.isTopProduct ? (
          <Badge className="absolute left-3 top-3 z-10 bg-green-100 text-green-700">
            NAJPREDÁVANEJŠIE
          </Badge>
        ) : null}
        {primaryImage?.url ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.alt ?? product.name}
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
            <PriceDisplay price={priceValue} mode={mode} size="md" showFrom />
          ) : (
            <div className="text-sm text-muted-foreground">Na vyžiadanie</div>
          )}
        </div>

        <div className="flex gap-2">
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
                asChild
                mode={mode}
                variant="outline"
                size="md"
                className="flex-1"
              >
                <Link href={`/product/${product.slug}`}>
                  <MessageSquare className="h-4 w-4" />
                  Cenová ponuka
                </Link>
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
