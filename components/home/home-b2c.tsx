"use client"

import Link from "next/link"
import Autoplay from "embla-carousel-autoplay"

import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"

export function HomeB2C() {
  return (
    <section className="space-y-6">

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
            "Rýchla tlač do 24 hodín",
            "Obľúbené produkty pre domácnosť",
            "Jednoduchá objednávka online",
          ].map((title) => (
            <CarouselItem key={title} className="basis-full">
              <div className="flex h-110 items-center justify-center rounded-lg border bg-card p-4 text-sm font-medium">
                {title}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
            <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Tlač pre každý deň</h1>
        <p className="text-muted-foreground">
          Vyberte si z rýchlych tlačových služieb pre domácnosť aj školu.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild className="sm:w-auto">
          <Link href="/catalog">Prejsť do katalógu</Link>
        </Button>
        <Button asChild variant="outline" className="sm:w-auto">
          <Link href="/kontaktujte-nas">Kontaktujte nás</Link>
        </Button>
      </div>
    </section>
  )
}
