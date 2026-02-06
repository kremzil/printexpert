"use client"

import Autoplay from "embla-carousel-autoplay"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"

export function HomeB2CHeroCarousel() {
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
          { title: "Rýchla tlač do 24 hodín", subtitle: "Expresné dodanie po celom Slovensku" },
          { title: "Obľúbené produkty pre domácnosť", subtitle: "Vizitky, letáky, kalendáre a viac" },
          { title: "Jednoduchá objednávka online", subtitle: "Bez zbytočných formalít" },
        ].map((item) => (
          <CarouselItem key={item.title} className="basis-full">
            <div className="group relative overflow-hidden rounded-lg border bg-card p-8 transition-all duration-300 hover:border-primary/50 hover:shadow-lg sm:p-12">
              <div className="absolute inset-0 paper-texture opacity-20" />
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl transition-transform duration-500 group-hover:scale-150" />
              <div className="relative space-y-2">
                <h2 className="font-display text-2xl font-bold sm:text-3xl">{item.title}</h2>
                <p className="text-muted-foreground">{item.subtitle}</p>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  )
}
