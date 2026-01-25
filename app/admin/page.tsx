import Link from "next/link"
import { Suspense } from "react"
import { Package, FolderTree, Sliders, Users, ArrowUpRight } from "lucide-react"

import { AdminProductsList } from "@/components/admin/admin-products-list"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminProducts } from "@/lib/catalog"
import { requireAdmin } from "@/lib/auth-helpers"

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

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <header className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Administrácia</h2>
        <p className="text-muted-foreground">
          Prehľad a správa obsahu systému.
        </p>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Produkty
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">
              Celkový počet produktov
            </p>
            <Link href="/admin/products">
              <Button variant="link" className="mt-2 h-auto p-0 text-xs">
                Zobraziť všetky
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Kategórie
            </CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">
              Štruktúra katalógu
            </p>
            <Link href="/admin/kategorie">
              <Button variant="link" className="mt-2 h-auto p-0 text-xs">
                Spravovať
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Vlastnosti
            </CardTitle>
            <Sliders className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">
              Definície produktov
            </p>
            <Link href="/admin/vlastnosti">
              <Button variant="link" className="mt-2 h-auto p-0 text-xs">
                Nastaviť
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
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
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">
              Správa prístupov
            </p>
            <Link href="/admin/users">
              <Button variant="link" className="mt-2 h-auto p-0 text-xs">
                Zobraziť
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Posledné produkty</CardTitle>
          <CardDescription>
            Prehľad produktov v systéme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
                Načítavame produkty…
              </div>
            }
          >
            <AdminProductsList products={products} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
