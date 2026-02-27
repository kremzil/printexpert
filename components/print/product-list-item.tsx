"use client"

import Image from "next/image"
import Link from "next/link"
import { Clock } from "lucide-react"

import type { CustomerMode } from "@/components/print/types"

type ProductListItemProps = {
  mode: CustomerMode
  href: string
  title: string
  description?: string | null
  image?: string | null
  priceFrom?: string | null
  deliveryTime?: string | null
}

export function ProductListItem({
  mode,
  href,
  title,
  description,
  image,
  priceFrom,
  deliveryTime,
}: ProductListItemProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const priceValue = priceFrom ? Number(priceFrom) : Number.NaN
  const plainDescription = description
    ? description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : ""

  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md md:flex-row"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted md:h-36 md:w-56">
        {image ? (
          <Image
            src={image}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 224px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Bez obrázka
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          {plainDescription && (
            <p className="text-sm text-muted-foreground">{plainDescription}</p>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            {Number.isFinite(priceValue) ? (
              <>
                <div className="text-xs text-muted-foreground">Cena od</div>
                <div className="text-lg font-semibold" style={{ color: modeColor }}>
                  {priceValue.toFixed(2)} €
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Na vyžiadanie</div>
            )}
          </div>

          {deliveryTime ? (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {deliveryTime}
            </div>
          ) : null}

          <span
            className="text-sm font-medium"
            style={{ color: modeColor }}
          >
            Zobraziť detail →
          </span>
        </div>
      </div>
    </Link>
  )
}
