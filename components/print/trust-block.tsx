"use client"

import {
  Archive,
  Award,
  FileCheck,
  Headphones,
  Shield,
  Truck,
  type LucideIcon,
} from "lucide-react"

import type { CustomerMode } from "@/components/print/types"

interface TrustBlockProps {
  mode: CustomerMode
  variant?: "compact" | "detailed"
}

interface TrustItem {
  icon: LucideIcon
  title: string
  description: string
}

const b2cTrustItems: TrustItem[] = [
  {
    icon: Truck,
    title: "Rýchle doručenie",
    description: "Expedícia do 24-48 hodín",
  },
  {
    icon: Shield,
    title: "Garancia kvality",
    description: "100% spokojnosť alebo peniaze späť",
  },
  {
    icon: FileCheck,
    title: "Kontrola súborov",
    description: "Zadarmo overíme vaše podklady",
  },
  {
    icon: Award,
    title: "Prémiové materiály",
    description: "Len overené dodávatelia",
  },
]

const b2bTrustItems: TrustItem[] = [
  {
    icon: FileCheck,
    title: "Profesionálny prepress",
    description: "Kontrola a úprava súborov zadarmo",
  },
  {
    icon: Archive,
    title: "Archivácia podkladov",
    description: "Dlhodobé uloženie pre opakovanie objednávok",
  },
  {
    icon: Headphones,
    title: "Osobný manažér",
    description: "Priamy kontakt na vášho obchodníka",
  },
  {
    icon: Truck,
    title: "Flexibilná logistika",
    description: "Osobný odber, kuriér, vlastná doprava",
  },
]

export function TrustBlock({ mode, variant = "compact" }: TrustBlockProps) {
  const items = mode === "b2c" ? b2cTrustItems : b2bTrustItems
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map((item, index) => {
          const Icon = item.icon
          return (
            <div key={index} className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor:
                    mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)",
                }}
              >
                <Icon className="h-5 w-5" style={{ color: modeColor }} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{item.title}</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <div
            key={index}
            className="flex flex-col items-center gap-3 text-center"
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)",
              }}
            >
              <Icon className="h-8 w-8" style={{ color: modeColor }} />
            </div>
            <div>
              <div className="mb-1 font-medium">{item.title}</div>
              <div className="text-sm text-muted-foreground">
                {item.description}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
