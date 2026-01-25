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
    <section className="relative">
      <div className="h-[60vh] sm:h-[70vh] flex items-center justify-center bg-linear-to-r from-indigo-600 via-violet-600 to-pink-600 text-white">
        <div className="max-w-4xl text-center px-6">
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight">
            Online tlačiareň pre celé Slovensko – rýchla a kvalitná tlač pre firmy, živnostníkov aj domácnosti
          </h1>
        </div>
      </div>

      <div className="mt-8 px-4">
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
