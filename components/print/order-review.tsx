"use client"

import type { CustomerMode } from "@/components/print/types"
import { PriceDisplay } from "@/components/print/price-display"
import { Card } from "@/components/ui/card"
import {
  Building2,
  Edit,
  FileCheck,
  Package,
  Truck,
} from "lucide-react"

interface OrderItem {
  id: string
  productName: string
  quantity: number
  pricePerUnit: number
  configuration: string
}

interface OrderReviewProps {
  mode: CustomerMode
  items: OrderItem[]
  shippingMethod: string
  shippingCost: number
  billingAddress: {
    companyName?: string
    name: string
    street: string
    city: string
    zipCode: string
    country: string
  }
  deliveryAddress?: {
    name: string
    street: string
    city: string
    zipCode: string
    country: string
  }
  onEditStep: (step: number) => void
  editSteps?: {
    items: number
    shipping: number
    billing: number
  }
}

export function OrderReview({
  mode,
  items,
  shippingMethod,
  shippingCost,
  billingAddress,
  deliveryAddress,
  onEditStep,
  editSteps,
}: OrderReviewProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const stepMap = editSteps ?? {
    items: 1,
    shipping: mode === "b2c" ? 1 : 2,
    billing: mode === "b2c" ? 1 : 2,
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.pricePerUnit,
    0
  )
  const totalWithoutVAT = subtotal + shippingCost
  const vatAmount = totalWithoutVAT * 0.2
  const totalWithVAT = totalWithoutVAT + vatAmount

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" style={{ color: modeColor }} />
            <h3 className="font-semibold">Položky objednávky</h3>
          </div>
          <button
            onClick={() => onEditStep(stepMap.items)}
            className="text-sm font-medium hover:underline"
            style={{ color: modeColor }}
          >
            <Edit className="mr-1 inline h-3.5 w-3.5" />
            Upraviť
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex-1">
                <div className="mb-1 font-medium">{item.productName}</div>
                <div className="text-xs text-muted-foreground">
                  {item.configuration}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {item.quantity} ks ×{" "}
                  <PriceDisplay price={item.pricePerUnit} mode={mode} size="sm" />
                </div>
              </div>
              <div className="font-semibold">
                <PriceDisplay
                  price={item.quantity * item.pricePerUnit}
                  mode={mode}
                  size="md"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <FileCheck className="h-4 w-4 flex-shrink-0" />
          <span>Všetky súbory boli úspešne nahrané</span>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5" style={{ color: modeColor }} />
              <h3 className="font-semibold">Doručenie</h3>
            </div>
            <button
              onClick={() => onEditStep(stepMap.shipping)}
              className="text-sm font-medium hover:underline"
              style={{ color: modeColor }}
            >
              <Edit className="mr-1 inline h-3.5 w-3.5" />
              Upraviť
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div>
              <div className="font-medium">{shippingMethod}</div>
              <div className="text-muted-foreground">
                {shippingCost === 0 ? (
                  "Zdarma"
                ) : (
                  <PriceDisplay
                    price={shippingCost}
                    mode={mode}
                    size="sm"
                  />
                )}
              </div>
            </div>

            {deliveryAddress && (
              <div className="mt-3 rounded-lg bg-muted/50 p-3">
                <div className="font-medium">{deliveryAddress.name}</div>
                <div className="text-muted-foreground">
                  {deliveryAddress.street}
                  <br />
                  {deliveryAddress.zipCode} {deliveryAddress.city}
                  <br />
                  {deliveryAddress.country}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" style={{ color: modeColor }} />
              <h3 className="font-semibold">Fakturačné údaje</h3>
            </div>
            <button
              onClick={() => onEditStep(stepMap.billing)}
              className="text-sm font-medium hover:underline"
              style={{ color: modeColor }}
            >
              <Edit className="mr-1 inline h-3.5 w-3.5" />
              Upraviť
            </button>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            {billingAddress.companyName && (
              <div className="mb-2 font-medium">
                {billingAddress.companyName}
              </div>
            )}
            <div
              className={
                billingAddress.companyName ? "text-muted-foreground" : "font-medium"
              }
            >
              {billingAddress.name}
            </div>
            <div className="text-muted-foreground">
              {billingAddress.street}
              <br />
              {billingAddress.zipCode} {billingAddress.city}
              <br />
              {billingAddress.country}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="mb-4 font-semibold">Celková suma</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Medzisúčet:</span>
            <PriceDisplay price={subtotal} mode={mode} size="sm" showVAT={false} />
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Doprava:</span>
            {shippingCost === 0 ? (
              <span className="font-medium text-green-600">Zdarma</span>
            ) : (
              <PriceDisplay price={shippingCost} mode={mode} size="sm" showVAT={false} />
            )}
          </div>

          {mode === "b2b" && (
            <>
              <div className="border-t border-border pt-2">
                <div className="flex justify-between font-medium">
                  <span>Celkom bez DPH:</span>
                  <PriceDisplay price={totalWithoutVAT} mode={mode} size="md" showVAT={false} />
                </div>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">DPH 20%:</span>
                <span>+{vatAmount.toFixed(2)} €</span>
              </div>
            </>
          )}

          <div className="border-t border-border pt-2">
            <div className="flex justify-between text-lg font-bold">
              <span>Celkom {mode === "b2c" ? "s DPH" : ""}:</span>
              {mode === "b2c" ? (
                <PriceDisplay price={totalWithVAT} mode={mode} size="lg" />
              ) : (
                <span>{totalWithVAT.toFixed(2)} €</span>
              )}
            </div>
            {mode === "b2c" && (
              <div className="mt-1 text-right text-xs text-muted-foreground">
                Obsahuje DPH 20%: {vatAmount.toFixed(2)} €
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
