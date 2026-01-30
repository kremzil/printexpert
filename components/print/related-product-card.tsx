"use client"

import Link from "next/link"

import { PriceDisplay } from "@/components/print/price-display"
import type { CustomerMode } from "@/components/print/types"

interface RelatedProductCardProps {
  mode: CustomerMode
  href: string
  title: string
  description?: string | null
  image?: string | null
  priceFrom?: string | null
  badge?: string
}

export function RelatedProductCard({
  mode,
  href,
  title,
  description,
  image,
  priceFrom,
  badge,
}: RelatedProductCardProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const priceValue = priceFrom ? Number(priceFrom) : Number.NaN
  const hasPrice = Number.isFinite(priceValue)

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:shadow-lg">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-muted">
        {image ? (
          <img
            src={image}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Bez obrázka
          </div>
        )}
        {badge && (
          <div
            className="absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: modeColor }}
          >
            {badge}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <Link href={href} className="block">
            <h3 className="mb-1 line-clamp-2 font-semibold">{title}</h3>
          </Link>
          {description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        <div className="mt-auto">
          {hasPrice ? (
            <PriceDisplay
              price={priceValue}
              mode={mode}
              size="md"
              showFrom
            />
          ) : (
            <div className="text-sm text-muted-foreground">Na vyžiadanie</div>
          )}
        </div>

        <Link
          href={href}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
        >
          Zobraziť detail
        </Link>
      </div>
    </div>
  )
}
