import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense, cache } from "react"

import { ProductPageClient } from "@/app/product/[slug]/product-page-client"
import { resolveAudienceContext } from "@/lib/audience-context"
import { getProductBySlug, getProducts } from "@/lib/catalog"
import { getProductCalculatorData } from "@/lib/pricing"

type ProductPageProps = {
  params: Promise<{
    slug: string
  }>
  searchParams?: Promise<{
    mode?: string
  }>
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://printexpert.sk"
const toPlainText = (value?: string | null) =>
  value ? value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null

const getCachedProductBySlug = cache(async (slug: string) => getProductBySlug(slug))

export async function generateStaticParams() {
  const { getProducts } = await import("@/lib/catalog")
  const products = await getProducts({})
  return products.map((product) => ({
    slug: product.slug,
  }))
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getCachedProductBySlug(slug)
  const descriptionSource = product?.excerpt || product?.description || null
  const description =
    toPlainText(descriptionSource) ?? "Produkty na mieru od PrintExpert."
  const title = product?.name ? `${product.name} | PrintExpert` : "Produkt | PrintExpert"

  return {
    alternates: {
      canonical: new URL(`/product/${slug}`, siteUrl),
    },
    title,
    description,
  }
}

async function ProductDetails({
  paramsPromise,
  searchParamsPromise,
}: {
  paramsPromise: ProductPageProps["params"]
  searchParamsPromise?: ProductPageProps["searchParams"]
}) {
  const { slug } = await paramsPromise
  const resolvedSearchParams = searchParamsPromise
    ? await searchParamsPromise
    : {}
  const audienceContext = await resolveAudienceContext({
    searchParams: resolvedSearchParams,
  })
  const product = await getCachedProductBySlug(slug)

  // enforce product visibility per audience preference
  if (audienceContext?.audience === "b2b" && product && product.showInB2b === false) {
    notFound()
  }
  if (audienceContext?.audience === "b2c" && product && product.showInB2c === false) {
    notFound()
  }
  if (audienceContext?.audience === "b2b" && product?.category?.showInB2b === false) {
    notFound()
  }
  if (audienceContext?.audience === "b2c" && product?.category?.showInB2c === false) {
    notFound()
  }

  if (!product) {
    notFound()
  }

  const [calculatorData, relatedSource] = await Promise.all([
    getProductCalculatorData({
      productId: product.id,
    }),
    product.category?.slug
      ? getProducts({
          categorySlug: product.category.slug,
          audience: audienceContext.audience,
        })
      : Promise.resolve([]),
  ])
  const relatedProducts = relatedSource
    .filter((item) => item.id !== product.id)
    .slice(0, 3)
    .map((item) => {
      const excerptText = item.excerpt
        ? item.excerpt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : null
      return {
        id: item.id,
        slug: item.slug,
        name: item.name,
        excerpt: excerptText,
        priceFrom: item.priceFrom,
        images: item.images ?? [],
      }
    })
  const descriptionHtml = product.description ?? null
  const excerptHtml = product.excerpt ?? null
  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c"
  return (
    <ProductPageClient
      mode={mode}
      productId={product.id}
      calculatorData={calculatorData}
      relatedProducts={relatedProducts}
      product={{
        name: product.name,
        excerptHtml,
        descriptionHtml,
        images: product.images ?? [],
      }}
    />
  )
}

export default function ProductPage({ params, searchParams }: ProductPageProps) {
  return (
    <Suspense
      fallback={
        <section className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-7 w-1/2 rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
          </div>
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            Načítavame detail produktu…
          </div>
        </section>
      }
    >
      <ProductDetails
        paramsPromise={params}
        searchParamsPromise={searchParams}
      />
    </Suspense>
  )
}
