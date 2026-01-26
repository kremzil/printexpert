import Link from "next/link"
import { Suspense } from "react"
import { Package, FolderTree, Sliders, Users, ShoppingCart, ArrowUpRight, TrendingUp, DollarSign, Activity, CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import { getAdminProducts } from "@/lib/catalog"
import { requireAdmin } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { formatPrice } from "@/lib/utils"
import { Overview } from "@/components/admin/overview"

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

  const products = await getAdminProducts()
  const productsCount = products.length
  const activeProductsCount = products.filter(p => p.isActive).length
  
  const ordersCount = await prisma.order.count()
  const pendingOrdersCount = await prisma.order.count({
    where: { status: "PENDING" }
  })
  
  const usersCount = await prisma.user.count()
  
  // Calculate revenue
  const totalRevenue = await prisma.order.aggregate({
    _sum: { total: true },
    where: { status: { not: "CANCELLED" } }
  })

  // Calculate graph data (Revenue per month for current year)
  const currentYear = new Date().getFullYear()
  const ordersForGraph = await prisma.order.findMany({
    where: {
      status: { not: "CANCELLED" },
      createdAt: {
        gte: new Date(currentYear, 0, 1),
        lt: new Date(currentYear + 1, 0, 1)
      }
    },
    select: {
      createdAt: true,
      total: true
    }
  })

  const monthlyTotals = new Array(12).fill(0)
  ordersForGraph.forEach(order => {
    const month = order.createdAt.getMonth()
    monthlyTotals[month] += Number(order.total)
  })

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Máj", "Jún", "Júl", "Aug", "Sep", "Okt", "Nov", "Dec"]
  const graphData = monthNames.map((name, index) => ({
    name,
    total: monthlyTotals[index]
  }))

  const recentOrders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          image: true,
        }
      }
    }
  })

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Prehľad výkonnosti a správa systému.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Add DateRangePicker or similar if needed */}
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Celkové tržby
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalRevenue._sum.total?.toString() || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Tento rok (okrem zrušených)
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Objednávky
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{ordersCount}</div>
            <p className="text-xs text-muted-foreground">
              {pendingOrdersCount} čakajúcich na vybavenie
            </p>
            <Link href="/admin/orders" className="absolute inset-0" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Produkty
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProductsCount} / {productsCount}</div>
            <p className="text-xs text-muted-foreground">
              Aktívne / Celkom
            </p>
            <Link href="/admin/products" className="absolute inset-0" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Používatelia
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{usersCount}</div>
            <p className="text-xs text-muted-foreground">
              Registrovaní zákazníci
            </p>
            <Link href="/admin/users" className="absolute inset-0" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Prehľad tržieb ({currentYear})</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <Overview data={graphData} />
          </CardContent>
        </Card>

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
                        <AvatarImage src={order.user?.image || "/avatars/01.png"} alt="Avatar" />
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
