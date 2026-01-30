import { ProductCard } from "@/components/product/product-card"

type TopProductsProps = {
  audience: "b2b" | "b2c"
}

type TopProduct = {
  id: string
  slug: string
  name: string
  excerpt?: string | null
  description?: string | null
  priceFrom?: string | null
  images?: Array<{
    url: string
    alt?: string | null
  }>
}

export async function TopProducts({ audience }: TopProductsProps) {
  let products: TopProduct[] = []

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/top-products?audience=${audience}&count=8`,
      { cache: "no-store" }
    )
    if (res.ok) {
      products = await res.json()
    }
  } catch (error) {
    console.error("Failed to fetch top products:", error)
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
            <ProductCard key={product.id} product={product} mode={audience} />
          ))}
        </div>
      </div>
    </section>
  )
}
