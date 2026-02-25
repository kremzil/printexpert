import Link from "next/link"
import { Suspense } from "react"
import { AlertTriangle, DollarSign, Package, ShoppingCart, Users } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AdminButton } from "@/components/admin/admin-button"
import { getAdminProducts } from "@/lib/catalog"
import { requireAdmin } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma"
import { formatPrice } from "@/lib/utils"
import { Overview } from "@/components/admin/overview"
import { StatCard } from "@/components/admin/stat-card"
import { ChartCard } from "@/components/admin/chart-card"

type DashboardSearchParams = {
  period?: string | string[]
  segment?: string | string[]
  recentStatus?: string | string[]
}

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED"] as const

const ORDER_STATUS_LABELS: Record<(typeof ORDER_STATUSES)[number], string> = {
  PENDING: "Čaká sa",
  CONFIRMED: "Potvrdená",
  PROCESSING: "Spracováva sa",
  COMPLETED: "Dokončená",
  CANCELLED: "Zrušená",
}

const normalizeString = (value?: string | string[]) => {
  if (!value) return ""
  if (Array.isArray(value)) return value[0] ?? ""
  return value
}

export default function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>
}) {
  return (
    <Suspense
      fallback={
        <section className="space-y-6">
          <header className="space-y-2">
            <div className="h-6 w-40 rounded bg-muted" />
            <div className="h-4 w-72 rounded bg-muted" />
          </header>
          <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
            Načítavame administráciu…
          </div>
        </section>
      }
    >
      <AdminPageContent searchParamsPromise={searchParams} />
    </Suspense>
  )
}

async function AdminPageContent({
  searchParamsPromise,
}: {
  searchParamsPromise?: Promise<DashboardSearchParams>
}) {
  await requireAdmin()

  const resolvedParams = searchParamsPromise ? await searchParamsPromise : {}
  const periodParam = normalizeString(resolvedParams.period)
  const segmentParam = normalizeString(resolvedParams.segment)
  const recentStatusParam = normalizeString(resolvedParams.recentStatus)

  const period: "mesiac" | "stvrtrok" = periodParam === "stvrtrok" ? "stvrtrok" : "mesiac"
  const segment: "all" | "b2b" | "b2c" =
    segmentParam === "b2b" || segmentParam === "b2c" ? segmentParam : "all"
  const recentStatus: "all" | (typeof ORDER_STATUSES)[number] =
    ORDER_STATUSES.includes(recentStatusParam as (typeof ORDER_STATUSES)[number])
      ? (recentStatusParam as (typeof ORDER_STATUSES)[number])
      : "all"

  const now = new Date()
  const periodStart =
    period === "mesiac"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0)
      : new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0)

  const orderFilterBase: Prisma.OrderWhereInput = {
    ...(segment === "all" ? {} : { audience: segment }),
    NOT: {
      AND: [{ paymentMethod: { equals: "STRIPE" } }, { paymentStatus: { equals: "UNPAID" } }],
    },
  }

  const [
    products,
    ordersCount,
    pendingOrdersCount,
    usersCount,
    totalRevenue,
    ordersForGraph,
    recentOrders,
    cancelledInPeriodCount,
    pendingPaymentInPeriodCount,
  ] = await Promise.all([
    getAdminProducts(),
    prisma.order.count({
      where: orderFilterBase,
    }),
    prisma.order.count({
      where: {
        ...orderFilterBase,
        status: "PENDING",
      },
    }),
    prisma.user.count(),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        ...orderFilterBase,
        status: { not: "CANCELLED" },
        createdAt: { gte: periodStart, lte: now },
      },
    }),
    prisma.order.findMany({
      where: {
        ...orderFilterBase,
        status: { not: "CANCELLED" },
        createdAt: { gte: periodStart, lte: now },
      },
      select: { createdAt: true, total: true },
    }),
    prisma.order.findMany({
      where: {
        ...orderFilterBase,
        ...(recentStatus === "all" ? {} : { status: recentStatus }),
      },
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        customerName: true,
        customerEmail: true,
        status: true,
        total: true,
      },
    }),
    prisma.order.count({
      where: {
        ...orderFilterBase,
        status: "CANCELLED",
        createdAt: { gte: periodStart, lte: now },
      },
    }),
    prisma.order.count({
      where: {
        ...orderFilterBase,
        paymentStatus: { in: ["UNPAID", "PENDING"] },
        createdAt: { gte: periodStart, lte: now },
      },
    }),
  ])

  const productsCount = products.length
  const activeProductsCount = products.filter((product) => product.isActive).length

  const graphData =
    period === "mesiac"
      ? buildDailyGraphData(ordersForGraph, now)
      : buildQuarterGraphData(ordersForGraph, now)

  const rangeLabel = period === "mesiac" ? "posledných 30 dní" : "posledný štvrťrok"

  const buildHref = (overrides: {
    period?: "mesiac" | "stvrtrok"
    segment?: "all" | "b2b" | "b2c"
    recentStatus?: "all" | (typeof ORDER_STATUSES)[number]
  }) => {
    const params = new URLSearchParams()
    const nextPeriod = overrides.period ?? period
    const nextSegment = overrides.segment ?? segment
    const nextRecentStatus = overrides.recentStatus ?? recentStatus
    params.set("period", nextPeriod)
    params.set("segment", nextSegment)
    params.set("recentStatus", nextRecentStatus)
    return `/admin?${params.toString()}`
  }

  const alerts: string[] = []
  if (pendingOrdersCount > 0) {
    alerts.push(`Objednávky čakajúce na vybavenie: ${pendingOrdersCount}`)
  }
  if (pendingPaymentInPeriodCount > 0) {
    alerts.push(`Objednávky bez úhrady (${rangeLabel}): ${pendingPaymentInPeriodCount}`)
  }
  if (cancelledInPeriodCount > 0) {
    alerts.push(`Zrušené objednávky (${rangeLabel}): ${cancelledInPeriodCount}`)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Obdobie:</span>
          <AdminButton asChild size="sm" variant={period === "mesiac" ? "primary" : "outline"}>
            <Link href={buildHref({ period: "mesiac" })}>Mesiac</Link>
          </AdminButton>
          <AdminButton asChild size="sm" variant={period === "stvrtrok" ? "primary" : "outline"}>
            <Link href={buildHref({ period: "stvrtrok" })}>Štvrťrok</Link>
          </AdminButton>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Segment:</span>
          <AdminButton asChild size="sm" variant={segment === "all" ? "primary" : "outline"}>
            <Link href={buildHref({ segment: "all" })}>Všetko</Link>
          </AdminButton>
          <AdminButton asChild size="sm" variant={segment === "b2b" ? "primary" : "outline"}>
            <Link href={buildHref({ segment: "b2b" })}>B2B</Link>
          </AdminButton>
          <AdminButton asChild size="sm" variant={segment === "b2c" ? "primary" : "outline"}>
            <Link href={buildHref({ segment: "b2c" })}>B2C</Link>
          </AdminButton>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Celkové tržby"
          value={formatPrice(totalRevenue._sum.total?.toString() || 0)}
          subtitle={`Za ${rangeLabel}`}
          icon={DollarSign}
        />

        <Link href="/admin/orders" className="block">
          <StatCard
            title="Objednávky"
            value={ordersCount}
            subtitle={`${pendingOrdersCount} čakajúcich na vybavenie`}
            icon={ShoppingCart}
          />
        </Link>

        <Link href="/admin/products" className="block">
          <StatCard
            title="Produkty"
            value={`${activeProductsCount} / ${productsCount}`}
            subtitle="Aktívne / Celkom"
            icon={Package}
          />
        </Link>

        <Link href="/admin/users" className="block">
          <StatCard
            title="Používatelia"
            value={usersCount}
            subtitle="Registrovaní zákazníci"
            icon={Users}
          />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <ChartCard title="Prehľad tržieb" subtitle={`Agregované dáta za ${rangeLabel}`}>
            <Overview data={graphData} />
          </ChartCard>
        </div>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Upozornenia</CardTitle>
            <CardDescription>Dôležité udalosti na kontrolu</CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Žiadne kritické upozornenia.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {alerts.map((alert) => (
                  <li key={alert} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                    <span>{alert}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Posledné objednávky</CardTitle>
            <CardDescription>Rýchly prehľad s filtrom stavu</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton asChild size="sm" variant={recentStatus === "all" ? "primary" : "outline"}>
              <Link href={buildHref({ recentStatus: "all" })}>Všetky</Link>
            </AdminButton>
            {ORDER_STATUSES.map((status) => (
              <AdminButton
                key={status}
                asChild
                size="sm"
                variant={recentStatus === status ? "primary" : "outline"}
              >
                <Link href={buildHref({ recentStatus: status })}>{ORDER_STATUS_LABELS[status]}</Link>
              </AdminButton>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Žiadne objednávky pre vybraný filter.</p>
          ) : (
            <div className="table-responsive rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-medium">Objednávka</th>
                    <th className="px-3 py-2 font-medium">Zákazník</th>
                    <th className="px-3 py-2 font-medium">Dátum</th>
                    <th className="px-3 py-2 font-medium">Suma</th>
                    <th className="px-3 py-2 font-medium">Stav</th>
                    <th className="px-3 py-2 text-right font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-medium">#{order.orderNumber}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Intl.DateTimeFormat("sk-SK", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(order.createdAt)}
                      </td>
                      <td className="px-3 py-2 font-semibold">{formatPrice(Number(order.total))}</td>
                      <td className="px-3 py-2">{ORDER_STATUS_LABELS[order.status]}</td>
                      <td className="px-3 py-2 text-right">
                        <AdminButton asChild size="sm" variant="outline">
                          <Link href={`/admin/orders/${order.id}`}>Otvoriť</Link>
                        </AdminButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function buildDailyGraphData(
  ordersForGraph: Array<{ createdAt: Date; total: unknown }>,
  now: Date
) {
  const data: Array<{ name: string; total: number }> = []
  const totals = new Map<string, number>()

  for (const order of ordersForGraph) {
    const key = `${order.createdAt.getFullYear()}-${order.createdAt.getMonth()}-${order.createdAt.getDate()}`
    totals.set(key, (totals.get(key) ?? 0) + Number(order.total))
  }

  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
    data.push({
      name: new Intl.DateTimeFormat("sk-SK", { day: "2-digit", month: "2-digit" }).format(day),
      total: totals.get(key) ?? 0,
    })
  }

  return data
}

function buildQuarterGraphData(
  ordersForGraph: Array<{ createdAt: Date; total: unknown }>,
  now: Date
) {
  const totals = new Map<string, number>()
  for (const order of ordersForGraph) {
    const key = `${order.createdAt.getFullYear()}-${order.createdAt.getMonth()}`
    totals.set(key, (totals.get(key) ?? 0) + Number(order.total))
  }

  const data: Array<{ name: string; total: number }> = []
  for (let offset = 2; offset >= 0; offset -= 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const key = `${month.getFullYear()}-${month.getMonth()}`
    data.push({
      name: new Intl.DateTimeFormat("sk-SK", { month: "short" }).format(month),
      total: totals.get(key) ?? 0,
    })
  }
  return data
}
