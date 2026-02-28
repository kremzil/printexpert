"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { resolveProductImageUrl } from "@/lib/image-url"

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

  const handlePrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const selectedImageUrl = resolveProductImageUrl(images[selectedIndex]?.url)

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
        {selectedImageUrl ? (
          <Image
            src={selectedImageUrl}
            alt={`${productName} - obrázok ${selectedIndex + 1}`}
            fill
            className="object-cover"
            priority
            sizes="(min-width: 1024px) 560px, 100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Bez obrázku
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg transition-all hover:scale-110 hover:bg-white"
              aria-label="Predchádzajúci obrázok"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg transition-all hover:scale-110 hover:bg-white"
              aria-label="Ďalší obrázok"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {images.length > 1 && (
          <div className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            {selectedIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((image, index) => {
            const imageUrl = resolveProductImageUrl(image.url)
            return (
              <button
                key={`${image.url}-${index}`}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border-2 transition-all",
                  index === selectedIndex
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-muted-foreground"
                )}
              >
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={`${productName} náhľad ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 120px, 25vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                    Bez obrázku
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
