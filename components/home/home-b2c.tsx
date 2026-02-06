import Link from "next/link"

import { ModeButton } from "@/components/print/mode-button"
import { HomeB2CHeroCarousel } from "@/components/home/home-b2c-hero-carousel"
import { TopProducts } from "@/components/home/top-products"
import { WhyChooseUsB2C } from "@/components/home/why-choose-us-b2c"
import { FaqB2C } from "@/components/home/faq-b2c"

export function HomeB2C() {
  return (
    <div className="space-y-16">
      <section className="space-y-8">
        {/* Hero carousel */}
        <HomeB2CHeroCarousel />

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
          <ModeButton asChild mode="b2c" size="lg" className="group ink-spread">
            <Link href="/catalog">
              Prejsť do katalógu
              <span className="ml-2 transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          </ModeButton>
          <ModeButton asChild mode="b2c" variant="outline" size="lg" className="print-frame">
            <Link href="/kontaktujte-nas">Kontaktujte nás</Link>
          </ModeButton>
        </div>
      </section>
      
      <TopProducts audience="b2c" />

      <WhyChooseUsB2C />

      <FaqB2C />
    </div>
  )
}
