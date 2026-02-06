"use client"

import Image from "next/image"
import Autoplay from "embla-carousel-autoplay"

import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"

export function HomeB2BHeroCarousel() {
  return (
    <Carousel
      plugins={[
        Autoplay({
          delay: 5000,
        }),
      ]}
      opts={{ loop: true }}
      className="w-full"
    >
      <CarouselContent>
        {[
          {
            src: "/homepage/b2b/BEACH-BANNER.webp",
            alt: "Beach banner pre firmy",
          },
          {
            src: "/homepage/b2b/cta_bannermesh-1.jpg",
            alt: "Bannermesh pre firemnú komunikáciu",
          },
          {
            src: "/homepage/b2b/cta_billboard-1.webp",
            alt: "Billboard pre značky",
          },
          {
            src: "/homepage/b2b/cta_rollup-3.jpg",
            alt: "Rollup prezentácie",
          },
        ].map((slide) => (
          <CarouselItem key={slide.src} className="basis-full">
            <div className="group relative h-110 w-full overflow-hidden rounded-lg border border-primary/20 bg-card shadow-sm transition-all duration-500 hover:border-primary/50 hover:shadow-xl">
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(min-width: 1024px) 1024px, 100vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="absolute bottom-0 left-0 right-0 translate-y-full p-6 transition-transform duration-500 group-hover:translate-y-0">
                <p className="font-display text-xl font-bold text-background">{slide.alt}</p>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  )
}
