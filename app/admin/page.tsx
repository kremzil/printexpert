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
        <h2 className="text-2xl font-semibold">Prehľad produktov</h2>
        <p className="text-sm text-muted-foreground">
          Správa a úprava produktov v systéme.
        </p>
      </header>

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
