import Link from "next/link"

import { Badge } from "@/components/ui/badge"
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
          <Link href="/admin/vlastnosti">Vlastnosti</Link>
        </Button>
      </div>

      <div className="rounded-lg border">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.6fr)_auto] gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>Názov</span>
          <span>Kategória</span>
          <span>Stav</span>
          <span className="text-right">Akcia</span>
        </div>
        {products.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            Zatiaľ tu nie sú žiadne produkty.
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.6fr)_auto] items-center gap-3 px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">{product.name}</div>
                <div className="text-xs text-muted-foreground">{product.slug}</div>
              </div>
              <div className="text-sm">
                {product.category?.name ?? "Bez kategórie"}
              </div>
              <Badge variant={product.isActive ? "secondary" : "outline"}>
                {product.isActive ? "Aktívny" : "Neaktívny"}
              </Badge>
              <div className="flex justify-end">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/products/${product.id}`}>Upraviť</Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
