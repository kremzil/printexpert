"use client"

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
}) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"
  const leadTime = "2-3 pracovné dni"

  return (
    <div className="sticky top-4 space-y-4">
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
              summaryItems.map((item) => (
                <div key={item.label} className="flex justify-between gap-4">
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
                Kontrola súborov zadarmo
              </span>
            </div>
          </div>

          <ModeButton
            mode={mode}
            variant="primary"
            size="lg"
            onClick={onAddToCart}
            className="w-full"
            disabled={isAddingToCart || hasUnavailable || price === null}
          >
            <ShoppingCart className="h-5 w-5" />
            Pridať do košíka
          </ModeButton>
        </div>
      </Card>

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
  )
}
