"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { MessageSquare, ShoppingCart } from "lucide-react"

import { ModeButton } from "@/components/print/mode-button"
import { PriceDisplay } from "@/components/print/price-display"
import type { CustomerMode } from "@/components/print/types"

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
  }
  mode?: CustomerMode
}

export function ProductCard({ product, mode = "b2c" }: Props) {
  const router = useRouter()
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

  const handleOpenProduct = () => {
    router.push(`/product/${product.slug}`)
  }

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-muted">
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
              mode={mode}
              variant="primary"
              size="md"
              onClick={handleOpenProduct}
              className="flex-1"
            >
              <ShoppingCart className="h-4 w-4" />
              Kúpiť
            </ModeButton>
          ) : (
            <>
              <ModeButton
                mode={mode}
                variant="outline"
                size="md"
                onClick={handleOpenProduct}
                className="flex-1"
              >
                <MessageSquare className="h-4 w-4" />
                Cenová ponuka
              </ModeButton>
              <ModeButton
                mode={mode}
                variant="primary"
                size="md"
                onClick={handleOpenProduct}
                className="flex-1"
              >
                Konfigurovať
              </ModeButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductCard
