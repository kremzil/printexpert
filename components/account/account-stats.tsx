"use client"

import type { CustomerMode } from "@/components/print/types"
import { Card } from "@/components/ui/card"
import { ShoppingCart, Package, TrendingUp, Award, FileText } from "lucide-react"

interface Stat {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  change?: string
  mode?: "b2c" | "b2b" | "both"
}

interface AccountStatsProps {
  mode: CustomerMode
  totalOrders: number
  activeOrders: number
  yearTotal: string
  loyaltyPoints?: number
  unpaidAmount?: string
}

export function AccountStats({
  mode,
  totalOrders,
  activeOrders,
  yearTotal,
  loyaltyPoints,
  unpaidAmount,
}: AccountStatsProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  const stats: Stat[] =
    mode === "b2c"
      ? [
          {
            label: "Celkové objednávky",
            value: totalOrders,
            icon: ShoppingCart,
            mode: "both",
          },
          {
            label: "Aktívne objednávky",
            value: activeOrders,
            icon: Package,
            mode: "both",
          },
          {
            label: "Tento rok",
            value: yearTotal,
            icon: TrendingUp,
            mode: "b2c",
          },
          {
            label: "Vernostné body",
            value: loyaltyPoints || 0,
            icon: Award,
            mode: "b2c",
          },
        ]
      : [
          {
            label: "Celkové objednávky",
            value: totalOrders,
            icon: ShoppingCart,
            mode: "both",
          },
          {
            label: "Aktívne objednávky",
            value: activeOrders,
            icon: Package,
            mode: "both",
          },
          {
            label: "Tento rok",
            value: yearTotal,
            icon: TrendingUp,
            mode: "both",
          },
          {
            label: "Nevyfaktorované",
            value: unpaidAmount || "0",
            icon: FileText,
            mode: "b2b",
          },
        ]

  const filteredStats = stats.filter(
    (stat) => !stat.mode || stat.mode === mode || stat.mode === "both"
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {filteredStats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card key={index} className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: modeAccent, color: modeColor }}
              >
                <Icon className="h-6 w-6" />
              </div>
            </div>
            <div>
              <div className="mb-1 text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
