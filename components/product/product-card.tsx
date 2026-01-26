import Image from "next/image"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  product: {
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
}

export function ProductCard({ product }: Props) {
  const primaryImage = product.images?.[0]
  const shortDescription =
    product.excerpt ||
    (product.description
      ? `${String(product.description).slice(0, 160).trim()}${
          String(product.description).length > 160 ? "…" : ""
        }`
      : "")

  return (
    <Link href={`/product/${product.slug}`} className="group block h-full"> 
      <Card className="h-full overflow-hidden border-border/40 bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:-translate-y-1">
        <div className="relative aspect-square w-full overflow-hidden bg-secondary/10">
          {primaryImage?.url ? (
            <Image
              src={primaryImage.url}
              alt={primaryImage.alt ?? product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
              No image
            </div>
          )}
          
          {/* Overlay gradient on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>

        <CardContent className="flex flex-col gap-2 p-5 text-left">
          <div className="space-y-1">
            <CardTitle className="font-display text-lg font-bold leading-tight decoration-primary/50 decoration-2 underline-offset-4 transition-colors group-hover:text-primary text-left">
              {product.name}
            </CardTitle>
            {shortDescription && (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {shortDescription}
              </p>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between pt-3">
            <div className="flex flex-col">
              {product.priceFrom ? (
                <>
                  <span className="text-xs text-muted-foreground">Cena od</span>
                  <span className="font-bold text-primary">
                    {product.priceFrom} €
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  Na vyžiadanie
                </span>
              )}
            </div>
            
            <div 
              className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground opacity-0 shadow-sm transition-all duration-300 group-hover:opacity-100 group-hover:bg-primary group-hover:text-primary-foreground"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-arrow-right"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default ProductCard
