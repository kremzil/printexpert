import Image from "next/image"
import Link from "next/link"
import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  product: any
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
      <Card className="relative h-full overflow-hidden py-0 transition-colors group-hover:border-primary/30">
        <CardHeader className="p-0">
          <div className="relative aspect-square w-full overflow-hidden">
            {primaryImage?.url ? (
              <Image
                src={primaryImage.url}
                alt={primaryImage.alt ?? product.name}
                fill
                className="object-cover transition-[filter] duration-300 group-hover:brightness-105 group-hover:contrast-90 group-hover:saturate-95"
                sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
              />
            ) : null}
          </div>
        </CardHeader>

        {/* Всегда видимый блок снизу. На hover увеличивает высоту ВНУТРЬ карточки и наезжает на картинку. */}
<CardContent
  className="
    absolute bottom-0 left-0 right-0 z-20
    bg-background/95 backdrop-blur-sm
    overflow-hidden
    transition-[height,transform] duration-300
    px-4
    h-20 group-hover:h-32
    pt-6 pb-6
  "
>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base leading-snug">{product.name}</CardTitle>
            {product.priceFrom ? (
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {product.priceFrom} €
              </span>
            ) : (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Na vyžiadanie
              </span>
            )}
          </div>

          {/* Описание появляется внутри увеличенной высоты, сетку не ломает */}
          <p
            className="
              mt-2 text-xs text-muted-foreground
              opacity-0 translate-y-1
              transition-all duration-300
              group-hover:opacity-100 group-hover:translate-y-0
              line-clamp-3
            "
          >
            {shortDescription}
          </p>
        </CardContent>

        {/* чтобы нижний блок не перекрывал картинку по клику (если нужно) */}
        <div className="absolute inset-0 z-10" />
      </Card>
    </Link>
  )
}

export default ProductCard
