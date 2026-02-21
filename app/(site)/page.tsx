import { Suspense } from "react"

import { resolveAudienceContext } from "@/lib/audience-context"
import { Homepage } from "@/components/print/homepage"
import { getCategories, getHomepageCollections, getProducts, getTopProducts } from "@/lib/catalog"
import { buildHomepageModel } from "@/lib/homepage-model"
import { buildStaticPageMetadata } from "@/lib/seo"

export const metadata = buildStaticPageMetadata("home")

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
  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c"

  const [categories, products, topProducts, collections] = await Promise.all([
    getCategories(),
    getProducts({ audience: mode }),
    getTopProducts(mode, 8),
    getHomepageCollections(mode),
  ])

  const { homepageCategories, featuredProducts } = buildHomepageModel({
    mode,
    categories,
    products,
    topProducts,
    fallbackCount: 8,
  })

  return (
    <Homepage
      mode={mode}
      categories={homepageCategories}
      featuredProducts={featuredProducts}
      collections={collections}
    />
  )
}

function HomeSkeleton() {
  return (
    <div className="w-full">
      {/* Hero skeleton */}
      <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-hidden py-16 md:py-24 bg-gradient-to-br from-gray-50 via-gray-100 to-white">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="space-y-6">
              <div className="h-8 w-56 rounded-full bg-muted animate-pulse" />
              <div className="space-y-3">
                <div className="h-12 w-3/4 rounded bg-muted animate-pulse" />
                <div className="h-12 w-1/2 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-6 w-full rounded bg-muted animate-pulse" />
              <div className="h-6 w-2/3 rounded bg-muted animate-pulse" />
              <div className="flex gap-4">
                <div className="h-14 w-48 rounded-lg bg-muted animate-pulse" />
                <div className="h-14 w-48 rounded-lg bg-muted animate-pulse" />
              </div>
              <div className="grid grid-cols-3 gap-6 pt-6">
                <div className="space-y-2"><div className="h-8 w-16 rounded bg-muted animate-pulse" /><div className="h-4 w-24 rounded bg-muted animate-pulse" /></div>
                <div className="space-y-2"><div className="h-8 w-16 rounded bg-muted animate-pulse" /><div className="h-4 w-24 rounded bg-muted animate-pulse" /></div>
                <div className="space-y-2"><div className="h-8 w-16 rounded bg-muted animate-pulse" /><div className="h-4 w-24 rounded bg-muted animate-pulse" /></div>
              </div>
            </div>
            <div className="relative aspect-square rounded-2xl bg-muted animate-pulse" />
          </div>
        </div>
      </div>

      {/* Categories skeleton */}
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-8 text-center space-y-3">
          <div className="mx-auto h-10 w-64 rounded bg-muted animate-pulse" />
          <div className="mx-auto h-5 w-96 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 basis-[85%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/5">
              <div className="h-80 rounded-xl bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Page({ searchParams }: HomePageProps) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent searchParamsPromise={searchParams} />
    </Suspense>
  )
}
