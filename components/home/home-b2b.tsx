"use client"

import Image from "next/image"
import Link from "next/link"
import Autoplay from "embla-carousel-autoplay"
import dynamic from "next/dynamic"

import { ModeButton } from "@/components/print/mode-button"
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import { WhyChooseUsB2B } from "@/components/home/why-choose-us-b2b"
import { FaqB2B } from "@/components/home/faq-b2b"

const TopProductsClient = dynamic(
  () => import("@/components/home/top-products-client"),
  { ssr: false }
)

export function HomeB2B() {
  return (
    <div className="space-y-16">
      <section className="space-y-8">
        {/* Professional B2B carousel */}
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

        {/* Professional heading */}
        <div className="space-y-4 text-center pt-8">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Tlačové riešenia pre firmy
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Pomôžeme vám s veľkoobjemovou tlačou, brandingom aj výrobou na mieru.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <ModeButton asChild mode="b2b" size="lg" className="group ink-spread">
            <Link href="/catalog">
              Prejsť do katalógu
              <span className="ml-2 transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          </ModeButton>
          <ModeButton asChild mode="b2b" variant="outline" size="lg" className="print-frame">
            <Link href="/kontaktujte-nas">Požiadať o ponuku</Link>
          </ModeButton>
        </div>
      </section>
      
      <TopProductsClient audience="b2b" />

      <WhyChooseUsB2B />

      <FaqB2B />
    </div>
  )
}
