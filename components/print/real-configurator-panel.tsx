"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Clock, FileCheck, ShoppingCart, Truck } from "lucide-react"

import { Card } from "@/components/ui/card"
import { ModeButton } from "@/components/print/mode-button"
import { PriceDisplay } from "@/components/print/price-display"
import type { CustomerMode } from "@/components/print/types"

export function RealConfiguratorPanel({
  mode,
  summaryItems,
  price,
  hasUnavailable,
  isAddingToCart,
  serverError,
  quantityPresets,
  getTotalForQuantity,
  activeQuantity,
  onAddToCart,
  showFloatingBar,
  shareSection,
}: {
  mode: CustomerMode
  summaryItems: Array<{ label: string; value: string }>
  price: number | null
  hasUnavailable: boolean
  isAddingToCart: boolean
  serverError: string | null
  quantityPresets: number[]
  getTotalForQuantity: (quantity: number) => number | null
  activeQuantity: number
  onAddToCart: () => void
  showFloatingBar: boolean
  shareSection?: ReactNode
}) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"
  const leadTime = "2-3 pracovné dni"
  const isAddToCartDisabled = isAddingToCart || hasUnavailable || price === null
  const buyButtonRef = useRef<HTMLDivElement | null>(null)
  const [isBuyButtonVisible, setIsBuyButtonVisible] = useState(false)

  useEffect(() => {
    const target = buyButtonRef.current
    if (!target) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsBuyButtonVisible(entry.isIntersecting)
      },
      { threshold: 0.2 }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {showFloatingBar && !isBuyButtonVisible ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-30 px-3 pt-2 lg:hidden">
          <Card className="pointer-events-auto mx-auto w-full max-w-md border-border/60 bg-background/95 p-3 shadow-md backdrop-blur supports-backdrop-filter:bg-background/80">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Cena konfigurácie</p>
                {hasUnavailable ? (
                  <div className="text-sm text-destructive">Kombinácia nie je dostupná.</div>
                ) : price === null ? (
                  <div className="text-sm text-muted-foreground">Zadajte všetky údaje.</div>
                ) : (
                  <PriceDisplay price={price} mode={mode} size="sm" showVAT={false} />
                )}
              </div>
              <ModeButton
                mode={mode}
                variant="primary"
                size="sm"
                onClick={onAddToCart}
                className="shrink-0 whitespace-nowrap"
                disabled={isAddToCartDisabled}
              >
                <ShoppingCart className="h-4 w-4" />
                Pridať do košíka
              </ModeButton>
            </div>
            {serverError ? (
              <div className="mt-2 text-xs text-destructive">{serverError}</div>
            ) : null}
          </Card>
        </div>
      ) : null}

      <div className="sticky top-25 space-y-4">
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 font-semibold">Vaša konfigurácia</h3>
              <p className="text-sm text-muted-foreground">
                {activeQuantity} ks
              </p>
            </div>

            <div className="space-y-2 text-sm">
              {summaryItems.length === 0 ? (
                <div className="text-muted-foreground">
                  Vyberte možnosti konfigurácie.
                </div>
              ) : (
                summaryItems.map((item, index) => (
                  <div
                    key={`${item.label}-${item.value}-${index}`}
                    className="flex justify-between gap-4"
                  >
                    <span className="text-muted-foreground">{item.label}:</span>
                    <span className="font-medium text-right">{item.value}</span>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-border pt-4">
              {hasUnavailable ? (
                <div className="text-sm text-destructive">
                  Kombinácia nie je dostupná.
                </div>
              ) : price === null ? (
                <div className="text-sm text-muted-foreground">
                  Zadajte všetky údaje.
                </div>
              ) : (
                <PriceDisplay price={price} mode={mode} size="xl" />
              )}
              {serverError ? (
                <div className="mt-2 text-sm text-destructive">{serverError}</div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Dodanie:</span>
                <span className="font-medium">{leadTime}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Doprava:</span>
                <span className="font-medium">Kuriér alebo osobný odber</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileCheck className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium" style={{ color: modeColor }}>
                  Kontrola súborov v cene
                </span>
              </div>
            </div>

            <div ref={buyButtonRef}>
              <ModeButton
                mode={mode}
                variant="primary"
                size="lg"
                onClick={onAddToCart}
                className="w-full"
                disabled={isAddToCartDisabled}
              >
                <ShoppingCart className="h-5 w-5" />
                Pridať do košíka
              </ModeButton>
            </div>
          </div>
        </Card>

        {shareSection ? <Card className="p-4">{shareSection}</Card> : null}

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Objemové zľavy</h4>
            <span className="text-xs text-muted-foreground">Podľa konfigurácie</span>
          </div>
          <div className="space-y-1 text-xs">
            {quantityPresets.map((qty) => {
              const computedPrice = getTotalForQuantity(qty)
              const isSelected = activeQuantity === qty
              return (
                <div
                  key={qty}
                  className={`flex justify-between rounded px-2 py-1 ${isSelected ? "font-medium" : ""}`}
                  style={{
                    backgroundColor: isSelected ? modeAccent : "transparent",
                    color: isSelected ? modeColor : undefined,
                  }}
                >
                  <span>{qty} ks</span>
                  <span>
                    {computedPrice === null ? "—" : `${computedPrice.toFixed(2)} €`}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </>
  )
}
