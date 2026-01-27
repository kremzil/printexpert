"use client"

import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

interface ProductImage {
  url: string
  alt?: string | null
}

interface ProductGalleryProps {
  images: ProductImage[]
  productName: string
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  if (!images.length) {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted/30">
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Bez obrázku
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted/30">
        <Image
          src={images[selectedIndex].url}
          alt={images[selectedIndex].alt ?? productName}
          fill
          className="object-contain"
          priority
          sizes="(min-width: 1024px) 560px, 100vw"
        />
      </div>
      
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-3 sm:gap-4">
          {images.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border bg-muted/30 ring-offset-background transition-all hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selectedIndex === index ? "ring-2 ring-primary ring-offset-2" : "opacity-70 hover:ring-2 hover:ring-primary/50"
              )}
            >
              <Image
                src={image.url}
                alt={image.alt ?? productName}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 120px, 25vw"
              />
              <span className="sr-only">Zobraziť obrázok {index + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
