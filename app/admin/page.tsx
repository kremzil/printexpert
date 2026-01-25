import Link from "next/link"
import { Suspense } from "react"

import { AdminProductsList } from "@/components/admin/admin-products-list"
import { Button } from "@/components/ui/button"
import { getAdminProducts } from "@/lib/catalog"

export default async function AdminPage() {
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
