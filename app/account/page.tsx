import { Suspense } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getPrisma } from "@/lib/prisma"
import { resolveAudienceContext } from "@/lib/audience-context"
import { AccountStats } from "@/components/account/account-stats"
import { OrderHistory } from "@/components/account/order-history"

async function AccountContent() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth")
  }

  const prisma = getPrisma()
  const audienceContext = await resolveAudienceContext()
  
  const currentYear = new Date().getFullYear()
  const startOfYear = new Date(currentYear, 0, 1)
  const startOfNextYear = new Date(currentYear + 1, 0, 1)
  const startOfLastYear = new Date(currentYear - 1, 0, 1)

  const [user, orders, totalOrders, activeOrders, yearOrders, lastYearOrders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    }),
    prisma.order.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            width: true,
            height: true,
            selectedOptions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.order.count({
      where: { userId: session.user.id },
    }),
    prisma.order.count({
      where: {
        userId: session.user.id,
        status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] },
      },
    }),
    prisma.order.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: startOfYear,
          lt: startOfNextYear,
        },
      },
      select: {
        total: true,
      },
    }),
    prisma.order.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: startOfLastYear,
          lt: startOfYear,
        },
      },
      select: {
        total: true,
      },
    }),
  ])

  if (!user) {
    redirect("/auth")
  }

  const yearTotal = yearOrders.reduce((sum, o) => sum + Number(o.total), 0)
  const lastYearTotal = lastYearOrders.reduce((sum, o) => sum + Number(o.total), 0)
  const yearChange = lastYearTotal > 0
    ? `${yearTotal >= lastYearTotal ? "+" : ""}${(((yearTotal - lastYearTotal) / lastYearTotal) * 100).toFixed(0)}%`
    : undefined
  const loyaltyPoints = Math.floor(yearTotal / 2)

  // Форматируем заказы для OrderHistory
  const mapOrderStatus = (status: string) => {
    switch (status) {
      case "PENDING":
        return "pending"
      case "CONFIRMED":
      case "PROCESSING":
        return "processing"
      case "COMPLETED":
        return "delivered"
      case "CANCELLED":
        return "cancelled"
      default:
        return "pending"
    }
  }

  const formatItemConfiguration = (item: {
    width: unknown
    height: unknown
    selectedOptions: unknown
  }) => {
    const parts: string[] = []
    const toNumber = (value: unknown) => {
      if (typeof value === "number") return value
      if (typeof value === "string" && value.trim() !== "") return Number(value)
      if (value && typeof value === "object" && "toNumber" in value) {
        try {
          return (value as { toNumber: () => number }).toNumber()
        } catch {
          return null
        }
      }
      return null
    }
    const width = toNumber(item.width)
    const height = toNumber(item.height)

    if (width && height) {
      parts.push(`${width}×${height} mm`)
    }

    if (item.selectedOptions && typeof item.selectedOptions === "object") {
      const entries = Object.entries(item.selectedOptions as Record<string, unknown>)
        .map(([key, value]) => {
          if (value === null || value === undefined) return null
          if (typeof value === "object") return null
          return `${key}: ${String(value)}`
        })
        .filter(Boolean) as string[]

      if (entries.length > 0) {
        parts.push(entries.join(", "))
      }
    }

    return parts.length > 0 ? parts.join(", ") : "Konfigurácia nie je dostupná"
  }

  const formattedOrders = orders.map(order => ({
    id: order.id,
    orderNumber: order.orderNumber,
    date: order.createdAt.toLocaleDateString("sk-SK"),
    status: mapOrderStatus(order.status) as "pending" | "processing" | "delivered" | "cancelled",
    items: order.items.map(item => ({
      name: item.productName,
      quantity: item.quantity,
      configuration: formatItemConfiguration(item),
    })),
    total: Number(order.total),
    estimatedDelivery:
      ["pending", "processing"].includes(mapOrderStatus(order.status))
        ? new Date(order.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString("sk-SK")
        : undefined,
  }))

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">
          Vitajte späť, {user.name?.split(" ")[0] || "Užívateľ"}!
        </h1>
        <p className="text-muted-foreground">
          Tu nájdete prehľad vašich objednávok a aktivít
        </p>
      </div>

      {/* Stats Grid */}
      <AccountStats
        mode={audienceContext.mode}
        totalOrders={totalOrders}
        activeOrders={activeOrders}
        yearTotal={`€${yearTotal.toFixed(2)}`}
        yearChange={yearChange}
        loyaltyPoints={loyaltyPoints}
        unpaidAmount="€0"
      />

      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Posledné objednávky</h2>
        </div>
        <OrderHistory
          mode={audienceContext.mode}
          orders={formattedOrders}
        />
        <div className="pt-4 text-center">
          <a
            href="/account/orders"
            className="text-sm font-medium hover:underline"
            style={{ color: audienceContext.mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)" }}
          >
            Zobraziť všetky objednávky →
          </a>
        </div>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
          Načítavam účet…
        </div>
      }
    >
      <AccountContent />
    </Suspense>
  )
}
