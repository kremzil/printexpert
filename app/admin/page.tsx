import Link from "next/link"
import { Suspense } from "react"

import { AdminProductsList } from "@/components/admin/admin-products-list"
import { Button } from "@/components/ui/button"
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
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Administrácia</h1>
        <p className="text-sm text-muted-foreground">
          Prehľad a základná správa obsahu.
        </p>
      </header>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm">
          Produkty
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/kategorie">Kategórie</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/vlastnosti">Vlastnosti</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/users">Používatelia</Link>
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
            Načítavame produkty…
          </div>
        }
      >
        <AdminProductsList products={products} />
      </Suspense>
    </section>
  )
}
