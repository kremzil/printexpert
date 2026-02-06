import Link from "next/link"
import { Suspense } from "react"
import { Package, Users, ShoppingCart, DollarSign } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import { getAdminProducts } from "@/lib/catalog"
import { requireAdmin } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { formatPrice } from "@/lib/utils"
import { Overview } from "@/components/admin/overview"
import { StatCard } from "@/components/admin/stat-card"
import { ChartCard } from "@/components/admin/chart-card"

export default function AdminPage() {
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
      <AdminPageContent />
    </Suspense>
  )
}

async function AdminPageContent() {
  await requireAdmin()

  const currentYear = new Date().getFullYear()

  // All queries are independent — run in parallel
  const [
    products,
    ordersCount,
    pendingOrdersCount,
    usersCount,
    totalRevenue,
    ordersForGraph,
    recentOrders,
  ] = await Promise.all([
    getAdminProducts(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.user.count(),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { not: "CANCELLED" } },
    }),
    prisma.order.findMany({
      where: {
        status: { not: "CANCELLED" },
        createdAt: {
          gte: new Date(currentYear, 0, 1),
          lt: new Date(currentYear + 1, 0, 1),
        },
      },
      select: { createdAt: true, total: true },
    }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true, email: true, image: true },
        },
      },
    }),
  ])

  const productsCount = products.length
  const activeProductsCount = products.filter(p => p.isActive).length

  const monthlyTotals = new Array(12).fill(0)
  ordersForGraph.forEach(order => {
    const month = order.createdAt.getMonth()
    monthlyTotals[month] += Number(order.total)
  })

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Máj", "Jún", "Júl", "Aug", "Sep", "Okt", "Nov", "Dec"]
  const graphData = monthNames.map((name, index) => ({
    name,
    total: monthlyTotals[index],
  }))

  return (
    <div className="p-6">
      {/* Stats Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Celkové tržby"
          value={formatPrice(totalRevenue._sum.total?.toString() || 0)}
          subtitle="Tento rok (okrem zrušených)"
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <ChartCard 
            title={`Prehľad tržieb (${currentYear})`}
            subtitle="Mesačné tržby za aktuálny rok"
          >
            <Overview data={graphData} />
          </ChartCard>
        </div>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Nedávne objednávky</CardTitle>
            <CardDescription>
              Za posledných 24 hodín bolo vytvorených {pendingOrdersCount} objednávok.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {recentOrders.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-8">Žiadne objednávky.</p>
              ) : (
                  recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center">
                        <Avatar className="h-9 w-9">
                        {order.user?.image && <AvatarImage src={order.user.image} alt="Avatar" />}
                        <AvatarFallback>{order.user?.name?.slice(0, 2).toUpperCase() || "OZ"}</AvatarFallback>
                        </Avatar>
                        <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{order.user?.name || "Neregistrovaný"}</p>
                        <p className="text-sm text-muted-foreground">
                            {order.user?.email || "bez emailu"}
                        </p>
                        </div>
                        <div className="ml-auto font-medium">
                            {formatPrice(Number(order.total))}
                        </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
