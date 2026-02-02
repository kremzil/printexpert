import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminProductsList } from "@/components/admin/admin-products-list";
import { AdminProductsImportDialog } from "@/components/admin/admin-products-import-dialog";
import { AdminButton } from "@/components/admin/admin-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminProducts } from "@/lib/catalog";
import { requireAdmin } from "@/lib/auth-helpers";

export default function AdminProductsPage() {
  return (
    <Suspense
      fallback={
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-40 rounded bg-muted" />
              <div className="h-4 w-72 rounded bg-muted" />
            </div>
          </div>
          <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
            Načítavame produkty…
          </div>
        </section>
      }
    >
      <AdminProductsPageContent />
    </Suspense>
  );
}

async function AdminProductsPageContent() {
  await requireAdmin();

  const products = await getAdminProducts();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produkty</h1>
          <p className="text-muted-foreground">
            Spravujte produkty v systéme ({products.length} produktov)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminProductsImportDialog />
          <Link href="/admin/products/new">
            <AdminButton icon={Plus}>
              Nový produkt
            </AdminButton>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Všetky produkty</CardTitle>
          <CardDescription>
            Prehľad a správa produktov
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
  );
}
