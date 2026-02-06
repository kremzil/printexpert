import Link from "next/link"

import { ModeButton } from "@/components/print/mode-button"
import { HomeB2BHeroCarousel } from "@/components/home/home-b2b-hero-carousel"
import { TopProducts } from "@/components/home/top-products"
import { WhyChooseUsB2B } from "@/components/home/why-choose-us-b2b"
import { FaqB2B } from "@/components/home/faq-b2b"

export function HomeB2B() {
  return (
    <div className="space-y-16">
      <section className="space-y-8">
        {/* Professional B2B carousel */}
        <HomeB2BHeroCarousel />

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
      
      <TopProducts audience="b2b" />

      <WhyChooseUsB2B />

      <FaqB2B />
    </div>
  )
}
