"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { startTransition, useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type AdminProductItem = {
  id: string
  name: string
  slug: string
  isActive: boolean
  category: {
    name: string
    slug: string
  } | null
}

type AdminProductsListProps = {
  products: AdminProductItem[]
}

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground"

export function AdminProductsList({ products }: AdminProductsListProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const query = searchParams.get("q") ?? ""
  const status = searchParams.get("status") ?? "all"
  const category = searchParams.get("category") ?? "all"

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    products.forEach((product) => {
      if (product.category?.slug && product.category?.name) {
        map.set(product.category.slug, product.category.name)
      }
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [products])

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return products.filter((product) => {
      if (status === "active" && !product.isActive) {
        return false
      }
      if (status === "inactive" && product.isActive) {
        return false
      }
      if (category === "none" && product.category) {
        return false
      }
      if (category !== "all" && category !== "none") {
        if (product.category?.slug !== category) {
          return false
        }
      }
      if (!normalizedQuery) {
        return true
      }
      const haystack = [
        product.name,
        product.slug,
        product.category?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [category, products, query, status])

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (!value || value === "all") {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    const search = next.toString()
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      })
    })
  }

  const handleQueryChange = (value: string) => {
    updateParam("q", value.trim())
  }

  const handleStatusChange = (value: string) => {
    updateParam("status", value)
  }

  const handleCategoryChange = (value: string) => {
    updateParam("category", value)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1.2fr_0.6fr_0.8fr]">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            Hľadať
          </div>
          <Input
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Názov, slug alebo kategória…"
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Stav</div>
          <select
            className={selectClassName}
            value={status}
            onChange={(event) => handleStatusChange(event.target.value)}
          >
            <option value="all">Všetky</option>
            <option value="active">Aktívne</option>
            <option value="inactive">Neaktívne</option>
          </select>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            Kategória
          </div>
          <select
            className={selectClassName}
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value)}
          >
            <option value="all">Všetky</option>
            <option value="none">Bez kategórie</option>
            {categoryOptions.map(([slug, name]) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Zobrazené produkty: {filteredProducts.length} / {products.length}
      </div>

      <div className="rounded-lg border">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.6fr)_auto] gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>Názov</span>
          <span>Kategória</span>
          <span>Stav</span>
          <span className="text-right">Akcia</span>
        </div>
        {filteredProducts.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            Žiadne produkty nezodpovedajú filtrom.
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div
              key={product.id}
              className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.6fr)_auto] items-center gap-3 px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">{product.name}</div>
                <div className="text-xs text-muted-foreground">
                  {product.slug}
                </div>
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
    </div>
  )
}
