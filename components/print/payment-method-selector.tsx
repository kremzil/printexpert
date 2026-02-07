"use client"

import type { ComponentType } from "react"
import { Building2, CreditCard } from "lucide-react"

import type { CustomerMode } from "@/components/print/types"
import { Card } from "@/components/ui/card"

export type PaymentMethod = "stripe" | "bank"

interface PaymentMethodOption {
  id: PaymentMethod
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
}

interface PaymentMethodSelectorProps {
  mode: CustomerMode
  selected: PaymentMethod
  onSelect: (method: PaymentMethod) => void
  variant?: "card" | "embedded"
}

const paymentMethods: PaymentMethodOption[] = [
  {
    id: "bank",
    title: "Bankový prevod",
    description: "Platba vopred na účet",
    icon: Building2,
  },
  {
    id: "stripe",
    title: "Platobná karta",
    description: "Okamžité spracovanie cez platobnú bránu",
    icon: CreditCard,
  },
]

export function PaymentMethodSelector({
  mode,
  selected,
  onSelect,
  variant = "card",
}: PaymentMethodSelectorProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  const TitleTag = variant === "embedded" ? "div" : "h3"
  const titleClassName =
    variant === "embedded" ? "text-sm font-semibold" : "mb-4 text-lg font-semibold"

  const content = (
    <>
      <TitleTag className={titleClassName} style={{ color: modeColor }}>
        Spôsob platby
      </TitleTag>
      <div className="space-y-3">
        {paymentMethods.map((method) => {
          const Icon = method.icon
          const isSelected = selected === method.id

          return (
            <button
              key={method.id}
              type="button"
              onClick={() => onSelect(method.id)}
              className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                isSelected ? "shadow-sm" : "border-border hover:border-muted-foreground"
              }`}
              style={{
                borderColor: isSelected ? modeColor : undefined,
                backgroundColor: isSelected ? modeAccent : undefined,
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? "text-white" : "bg-muted"
                  }`}
                  style={{
                    backgroundColor: isSelected ? modeColor : undefined,
                  }}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="font-semibold">{method.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </div>

                <div className="flex-shrink-0">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      isSelected ? "border-transparent" : "border-border"
                    }`}
                    style={{
                      backgroundColor: isSelected ? modeColor : "transparent",
                    }}
                  >
                    {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )

  if (variant === "embedded") {
    return <div className="space-y-4">{content}</div>
  }

  return <Card className="p-6">{content}</Card>
}
