import { Suspense } from "react"

import { resolveAudienceContext } from "@/lib/audience-context"
import { ModeSelectionPage } from "@/components/print/mode-selection-page"
import { Homepage } from "@/components/print/homepage"
import { getCategories, getProducts, getTopProducts } from "@/lib/catalog"
import { buildHomepageModel } from "@/lib/homepage-model"

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
  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c"

  if (isFirstVisit) {
    return <ModeSelectionPage />
  }

  const [categories, products, topProducts] = await Promise.all([
    getCategories(),
    getProducts({ audience: mode }),
    getTopProducts(mode, 8),
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
    />
  )
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
