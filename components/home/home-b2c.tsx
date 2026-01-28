"use client"

import Link from "next/link"
import Autoplay from "embla-carousel-autoplay"
import dynamic from "next/dynamic"

import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import { WhyChooseUsB2C } from "@/components/home/why-choose-us-b2c"
import { FaqB2C } from "@/components/home/faq-b2c"

const TopProductsClient = dynamic(
  () => import("@/components/home/top-products-client"),
  { ssr: false }
)

export function HomeB2C() {
  return (
    <div className="space-y-16">
      <section className="space-y-8">
        {/* Hero carousel с улучшенным дизайном */}
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

        {/* Heading section */}
        <div className="space-y-4 text-center pt-8">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Tlač pre každý deň
          </h1>
          <p className="mx-auto text-lg text-muted-foreground max-w-2xl">
            Vyberte si z rýchlych tlačových služieb pre domácnosť aj školu.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" className="group ink-spread">
            <Link href="/catalog">
              Prejsť do katalógu
              <span className="ml-2 transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="print-frame">
            <Link href="/kontaktujte-nas">Kontaktujte nás</Link>
          </Button>
        </div>
      </section>
      
      <TopProductsClient audience="b2c" />

      <WhyChooseUsB2C />

      <FaqB2C />
    </div>
  )
}
