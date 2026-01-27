import { Suspense } from "react"

import { resolveAudienceContext } from "@/lib/audience-context"
import { AudienceModeCards } from "@/components/audience-mode-cards"
import { HomeB2B } from "@/components/home/home-b2b"
import { HomeB2C } from "@/components/home/home-b2c"

type HomePageProps = {
  searchParams?: Promise<{
    mode?: string
  }>
}

async function HomeContent({
  searchParamsPromise,
}: {
  searchParamsPromise?: HomePageProps["searchParams"]
}) {
  const resolvedSearchParams = searchParamsPromise
    ? await searchParamsPromise
    : {}
  const audienceContext = await resolveAudienceContext({
    searchParams: resolvedSearchParams,
  })
  const isFirstVisit = audienceContext.source === "default"
  const isB2B = audienceContext.audience === "b2b"

if (isFirstVisit) {
  return (
    <section className="relative -mt-8">
      {/* Hero Section с Editorial стилем */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-background via-accent/5 to-background">
        <div className="absolute inset-0 paper-texture opacity-40" />
        <div className="relative mx-auto max-w-5xl px-6 py-20 sm:py-32">
          <div className="space-y-8 text-center">
            <div className="inline-block">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                </span>
                Online tlačiareň pre celé Slovensko
              </div>
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Rýchla a kvalitná tlač
              <br />
              <span className="ink-gradient">
                pre firmy aj domácnosti
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Profesionálne tlačové služby s dodaním do 24 hodín. Moderná technológia, 
              skvelé ceny a jednoduchá objednávka online.
            </p>
          </div>
        </div>
        
        {/* Geometrické dekorácie */}
        <div className="absolute left-0 top-0 h-px w-32 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute bottom-0 right-0 h-px w-32 bg-gradient-to-l from-transparent via-primary/50 to-transparent" />
      </div>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <AudienceModeCards />
      </div>
    </section>
  )
}


  return isB2B ? <HomeB2B /> : <HomeB2C />
}

export default function Page({ searchParams }: HomePageProps) {
  return (
    <Suspense
      fallback={
        <section className="space-y-3">
          <div className="h-6 w-40 rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </section>
      }
    >
      <HomeContent searchParamsPromise={searchParams} />
    </Suspense>
  )
}
