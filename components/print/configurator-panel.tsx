"use client"

import {
  Clock,
  FileCheck,
  Info,
  MessageSquare,
  ShoppingCart,
  Truck,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { ModeButton } from "@/components/print/mode-button"
import { PriceDisplay } from "@/components/print/price-display"
import type { CustomerMode } from "@/components/print/types"

export interface ConfiguratorState {
  format: string
  material: string
  printType: string
  finishing: string
  quantity: number
}

interface ConfiguratorPanelProps {
  mode: CustomerMode
  config: ConfiguratorState
  basePrice: number
  simple?: boolean
  onAddToCart?: () => void
  onRequestQuote?: () => void
}

function calculatePrice(config: ConfiguratorState, basePrice: number): number {
  let price = basePrice

  const materialPrices: Record<string, number> = {
    standard: 0,
    premium: 8,
    matte: 15,
    glossy: 15,
  }
  price += materialPrices[config.material] || 0

  if (config.printType === "double") {
    price += 5
  }

  const finishingPrices: Record<string, number> = {
    none: 0,
    "matte-lamination": 12,
    "glossy-lamination": 12,
    "rounded-corners": 3,
  }
  price += finishingPrices[config.finishing] || 0

  const quantityMultipliers: Record<number, number> = {
    100: 1,
    250: 0.85,
    500: 0.7,
    1000: 0.55,
    2500: 0.45,
  }
  const multiplier = quantityMultipliers[config.quantity] || 1

  return price * multiplier
}

function getLeadTime(config: ConfiguratorState): string {
  let days = 2

  if (["premium", "matte", "glossy"].includes(config.material)) {
    days += 1
  }

  if (config.finishing !== "none") {
    days += 1
  }

  return `${days}-${days + 1} pracovné dni`
}

export function ConfiguratorPanel({
  mode,
  config,
  basePrice,
  simple = false,
  onAddToCart,
  onRequestQuote,
}: ConfiguratorPanelProps) {
  const finalPrice = simple ? basePrice : calculatePrice(config, basePrice)
  const leadTime = getLeadTime(config)
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  const formatLabels: Record<string, string> = {
    standard: "85 × 55 mm (štandard)",
    euro: "85 × 54 mm (Európsky)",
    square: "55 × 55 mm (štvorec)",
    custom: "Vlastný rozmer",
  }

  const materialLabels: Record<string, string> = {
    standard: "Štandardný 350g/m²",
    premium: "Prémium 400g/m²",
    matte: "Matný 350g/m²",
    glossy: "Lesklý 350g/m²",
  }

  const printLabels: Record<string, string> = {
    single: "Jednostranná",
    double: "Obojstranná",
  }

  const finishingLabels: Record<string, string> = {
    none: "Bez úpravy",
    "matte-lamination": "Matná laminácia",
    "glossy-lamination": "Lesklá laminácia",
    "rounded-corners": "Zaoblené rohy",
  }

  return (
    <div className="sticky top-4 space-y-4">
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="mb-1 font-semibold">Vaša konfigurácia</h3>
            <p className="text-sm text-muted-foreground">
              {config.quantity} ks
            </p>
          </div>

          {!simple ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Formát:</span>
                <span className="font-medium">
                  {formatLabels[config.format]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Materiál:</span>
                <span className="font-medium">
                  {materialLabels[config.material]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tlač:</span>
                <span className="font-medium">
                  {printLabels[config.printType]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Úprava:</span>
                <span className="font-medium">
                  {finishingLabels[config.finishing]}
                </span>
              </div>
            </div>
          ) : null}

          <div className="border-t border-border pt-4">
            <PriceDisplay
              price={finalPrice}
              mode={mode}
              size="xl"
              showFrom={simple}
            />

            {!simple && config.quantity > 100 && (
              <div
                className="mt-2 rounded-lg p-2 text-xs"
                style={{ backgroundColor: modeAccent, color: modeColor }}
              >
                🎉 Ušetrili ste{" "}
                {(
                  (1 -
                    finalPrice /
                      (basePrice * (config.printType === "double" ? 1.25 : 1))) *
                  100
                ).toFixed(0)}
                % objemovou zľavou!
              </div>
            )}
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

          <div className="space-y-2">
            {mode === "b2c" ? (
              <ModeButton
                mode={mode}
                variant="primary"
                size="lg"
                onClick={onAddToCart}
                className="w-full"
              >
                <ShoppingCart className="h-5 w-5" />
                Pridať do košíka
              </ModeButton>
            ) : (
              <>
                <ModeButton
                  mode={mode}
                  variant="primary"
                  size="lg"
                  onClick={onAddToCart}
                  className="w-full"
                >
                  <ShoppingCart className="h-5 w-5" />
                  Pridať do košíka
                </ModeButton>
                <ModeButton
                  mode={mode}
                  variant="outline"
                  size="md"
                  onClick={onRequestQuote}
                  className="w-full"
                >
                  <MessageSquare className="h-5 w-5" />
                  Požiadať o cenovú ponuku
                </ModeButton>
              </>
            )}
          </div>
        </div>
      </Card>

      {!simple ? (
        <Card className="p-4">
          <h4 className="mb-3 text-sm font-semibold">Objemové zľavy</h4>
          <div className="space-y-1 text-xs">
            {[
              { qty: 100, discount: 0 },
              { qty: 250, discount: 15 },
              { qty: 500, discount: 30 },
              { qty: 1000, discount: 45 },
              { qty: 2500, discount: 55 },
            ].map(({ qty, discount }) => {
              const price = calculatePrice({ ...config, quantity: qty }, basePrice)
              const isSelected = config.quantity === qty
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
                  <span className="flex items-center gap-1">
                    {discount > 0 && (
                      <span className="text-muted-foreground">-{discount}%</span>
                    )}
                    <span>{price.toFixed(2)} €</span>
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      ) : null}

      {mode === "b2b" && (
        <Card className="p-4" style={{ backgroundColor: modeAccent }}>
          <div className="flex items-start gap-2">
            <Info
              className="mt-0.5 h-4 w-4 flex-shrink-0"
              style={{ color: modeColor }}
            />
            <div className="text-xs">
              <p className="mb-1 font-medium" style={{ color: modeColor }}>
                Potrebujete pomoc?
              </p>
              <p className="text-muted-foreground">
                Váš osobný manažér vám pomôže s výberom a optimalizáciou
                objednávky.
              </p>
              <button className="mt-2 font-medium underline" style={{ color: modeColor }}>
                Kontaktovať manažéra
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
