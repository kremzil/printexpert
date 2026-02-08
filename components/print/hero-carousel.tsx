"use client"

import * as React from "react"
import Image from "next/image"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { cn } from "@/lib/utils"

type HeroSlide = {
  src: string
  alt: string
}

type HeroCarouselProps = {
  slides: HeroSlide[]
  activeColor: string
}

export function HeroCarousel({ slides, activeColor }: HeroCarouselProps) {
  const [api, setApi] = React.useState<CarouselApi | null>(null)
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [snapCount, setSnapCount] = React.useState(0)
  const [isPaused, setIsPaused] = React.useState(false)

  React.useEffect(() => {
    if (!api) return

    const update = () => {
      setSelectedIndex(api.selectedScrollSnap())
      setSnapCount(api.scrollSnapList().length)
    }

    update()
    api.on("select", update)
    api.on("reInit", update)

    const pause = () => setIsPaused(true)
    const resume = () => setIsPaused(false)

    api.on("pointerDown", pause)
    api.on("pointerUp", resume)

    return () => {
      api.off("select", update)
      api.off("reInit", update)
      api.off("pointerDown", pause)
      api.off("pointerUp", resume)
    }
  }, [api])

  React.useEffect(() => {
    if (!api || isPaused) return

    const intervalId = window.setInterval(() => {
      if (!api) return
      if (api.canScrollNext()) {
        api.scrollNext()
      } else {
        api.scrollTo(0)
      }
    }, 6000)

    return () => window.clearInterval(intervalId)
  }, [api, isPaused])

  return (
    <div className="relative">
      <Carousel
        opts={{ align: "start", loop: true }}
        className="relative"
        setApi={setApi}
      >
        <CarouselContent>
          {slides.map((slide) => (
            <CarouselItem key={slide.src}>
              <div className="relative aspect-square overflow-hidden rounded-2xl shadow-2xl">
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="mt-4 flex items-center justify-center gap-2">
        {Array.from({ length: snapCount }).map((_, index) => (
          <button
            key={`hero-dot-${index}`}
            type="button"
            aria-label={`Prejsť na snímku ${index + 1}`}
            className={cn(
              "h-2.5 w-2.5 rounded-full transition-all",
              selectedIndex === index
                ? "scale-125"
                : "bg-muted-foreground/40"
            )}
            style={
              selectedIndex === index
                ? { backgroundColor: activeColor }
                : undefined
            }
            onClick={() => api?.scrollTo(index)}
          />
        ))}
      </div>
    </div>
  )
}
