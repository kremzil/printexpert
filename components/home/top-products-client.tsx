"use client"

import { useState, useEffect } from "react"
import { ProductCard } from "@/components/product/product-card"

type TopProductsClientProps = {
  audience: "b2b" | "b2c"
}

export default function TopProductsClient({ audience }: TopProductsClientProps) {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(`/api/top-products?audience=${audience}&count=8`)
        if (res.ok) {
          const data = await res.json()
          setProducts(data)
        }
      } catch (error) {
        console.error("Failed to fetch top products:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [audience])

  if (loading) {
    return (
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="mb-8 space-y-4">
            <div className="h-8 w-96 rounded bg-muted" />
            <div className="h-4 w-full max-w-3xl rounded bg-muted" />
            <div className="h-4 w-2/3 max-w-2xl rounded bg-muted" />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-80 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (!products || products.length === 0) {
    return null
  }

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto">
        <div className="mb-8 space-y-4">
          <h2 className="text-3xl font-bold tracking-tight">
            Top produkty pre online tlač
          </h2>
          <p className="text-muted-foreground max-w-3xl">
            Vitajte vo svete reklamy, kde sa inovácie stretávajú s dokonalosťou. 
            Naša spoločnosť je expertom na poskytovanie reklamných systémov a riešení, 
            ktoré premieňajú vašu víziu na skutočnosť. Naše rozsiahle portfólio zahŕňa 
            produkty vytvorené s vášňou a dôrazom na detaily.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}
