"use client"

import Image from "next/image"
import Link from "next/link"
import Autoplay from "embla-carousel-autoplay"
import dynamic from "next/dynamic"

import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"

const TopProductsClient = dynamic(
  () => import("@/components/home/top-products-client"),
  { ssr: false }
)

export function HomeB2B() {
  return (
    <>
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
                <div className="relative h-110 w-full overflow-hidden rounded-lg border bg-card">
                  <Image
                    src={slide.src}
                    alt={slide.alt}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 1024px, 100vw"
                    priority
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
              <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Tlačové riešenia pre firmy</h1>
          <p className="text-muted-foreground">
            Pomôžeme vám s veľkoobjemovou tlačou, brandingom aj výrobou na mieru.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="sm:w-auto">
            <Link href="/catalog">Prejsť do katalógu</Link>
          </Button>
          <Button asChild variant="outline" className="sm:w-auto">
            <Link href="/kontaktujte-nas">Požiadať o ponuku</Link>
          </Button>
        </div>
      </section>
      
      <TopProductsClient audience="b2b" />
    </>
  )
}
