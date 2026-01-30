"use client"

import type { CustomerMode } from "@/components/print/types"

interface PriceDisplayProps {
  price: number
  mode: CustomerMode
  size?: "sm" | "md" | "lg" | "xl"
  showFrom?: boolean
  oldPrice?: number
}

export function PriceDisplay({
  price,
  mode,
  size = "md",
  showFrom = false,
  oldPrice,
}: PriceDisplayProps) {
  const vatRate = 0.2
  const priceWithoutVat = price / (1 + vatRate)
  const vatAmount = price - priceWithoutVat

  const sizeClasses = {
    sm: { price: "text-lg", detail: "text-xs", from: "text-xs" },
    md: { price: "text-2xl", detail: "text-sm", from: "text-sm" },
    lg: { price: "text-3xl", detail: "text-base", from: "text-base" },
    xl: { price: "text-4xl", detail: "text-lg", from: "text-lg" },
  }

  const classes = sizeClasses[size]

  if (mode === "b2c") {
    return (
      <div className="flex flex-col">
        <div className="flex items-baseline gap-2">
          {showFrom && (
            <span className={`text-muted-foreground ${classes.from}`}>od</span>
          )}
          {oldPrice && (
            <span
              className={`text-muted-foreground line-through ${classes.detail}`}
            >
              {oldPrice.toFixed(2)} €
            </span>
          )}
          <span
            className={`font-bold ${classes.price}`}
            style={{ color: "var(--b2c-primary)" }}
          >
            {price.toFixed(2)} €
          </span>
        </div>
        <span className={`text-muted-foreground ${classes.detail}`}>s DPH</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-2">
        {showFrom && (
          <span className={`text-muted-foreground ${classes.from}`}>od</span>
        )}
        {oldPrice && (
          <span
            className={`text-muted-foreground line-through ${classes.detail}`}
          >
            {(oldPrice / (1 + vatRate)).toFixed(2)} €
          </span>
        )}
        <span
          className={`font-bold ${classes.price}`}
          style={{ color: "var(--b2b-primary)" }}
        >
          {priceWithoutVat.toFixed(2)} €
        </span>
      </div>
      <div className={`text-muted-foreground ${classes.detail}`}>
        bez DPH (+ {vatAmount.toFixed(2)} € DPH = {price.toFixed(2)} €)
      </div>
    </div>
  )
}
