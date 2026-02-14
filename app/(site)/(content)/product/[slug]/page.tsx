import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense, cache } from "react"

import { auth } from "@/auth"
import { ProductPageClient } from "@/app/(site)/(content)/product/[slug]/product-page-client"
import { resolveAudienceContext } from "@/lib/audience-context"
import { getProductBySlug, getRelatedProducts, getTopProductIds } from "@/lib/catalog"
import { getProductCalculatorData } from "@/lib/pricing"

type ProductSearchParams = {
  mode?: string
  st?: string
  sd?: string
  sc?: string
  sp?: string
  si?: string
}

type ProductPageProps = {
  params: Promise<{
    slug: string
  }>
  searchParams?: Promise<ProductSearchParams>
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://printexpert.sk"
const emptySearchParams: ProductSearchParams = {}
const toPlainText = (value?: string | null) =>
  value ? value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null
const normalizeMetadataText = (value?: string | null) =>
  value ? value.replace(/\s+/g, " ").trim() : null
const clampMetadataText = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
const sanitizeMetadataText = (value: string | undefined, maxLength: number) => {
  const normalized = normalizeMetadataText(value)
  return normalized ? clampMetadataText(normalized, maxLength) : null
}
const resolveAbsoluteUrl = (value: string | undefined) => {
  if (!value) {
    return null
  }
  try {
    const url = new URL(value, siteUrl)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

const getCachedProductBySlug = cache(async (slug: string) => getProductBySlug(slug))

export async function generateStaticParams() {
  try {
    const { getProducts } = await import("@/lib/catalog")
    const products = await getProducts({})
    return products.map((product) => ({
      slug: product.slug,
    }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: ProductPageProps): Promise<Metadata> {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(emptySearchParams),
  ])
  const product = await getCachedProductBySlug(slug)
  const descriptionSource = product?.excerpt || product?.description || null
  const fallbackDescription =
    toPlainText(descriptionSource) ?? "Produkty na mieru od PrintExpert."
  const fallbackTitle = product?.name ? `${product.name} | PrintExpert` : "Produkt | PrintExpert"
  const shareTitle = sanitizeMetadataText(resolvedSearchParams.st, 120)
  const shareDescription = sanitizeMetadataText(resolvedSearchParams.sd, 180)
  const shareConfiguration = sanitizeMetadataText(resolvedSearchParams.sc, 220)
  const sharePrice = sanitizeMetadataText(resolvedSearchParams.sp, 80)
  const title = shareTitle ?? fallbackTitle
  const description = [shareDescription, shareConfiguration, sharePrice]
    .filter((part): part is string => Boolean(part))
    .join(" • ") || fallbackDescription
  const canonicalUrl = new URL(`/product/${slug}`, siteUrl)
  const openGraphUrl = new URL(`/product/${slug}`, siteUrl)
  if (resolvedSearchParams.mode) {
    openGraphUrl.searchParams.set("mode", resolvedSearchParams.mode)
  }
  if (shareTitle) {
    openGraphUrl.searchParams.set("st", shareTitle)
  }
  if (shareDescription) {
    openGraphUrl.searchParams.set("sd", shareDescription)
  }
  if (shareConfiguration) {
    openGraphUrl.searchParams.set("sc", shareConfiguration)
  }
  if (sharePrice) {
    openGraphUrl.searchParams.set("sp", sharePrice)
  }
  const primaryImage = product?.images?.[0]
  const imageUrl =
    resolveAbsoluteUrl(resolvedSearchParams.si) ??
    (primaryImage?.url ? new URL(primaryImage.url, siteUrl).toString() : null)
  if (imageUrl) {
    openGraphUrl.searchParams.set("si", imageUrl)
  }
  const imageAlt = primaryImage?.alt ?? product?.name ?? "Produkt PrintExpert"

  return {
    alternates: {
      canonical: canonicalUrl,
    },
    title,
    description,
    openGraph: {
      type: "website",
      url: openGraphUrl,
      title,
      description,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              alt: imageAlt,
            },
          ]
        : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  }
}

async function ProductDetails({
  paramsPromise,
  searchParamsPromise,
}: {
  paramsPromise: ProductPageProps["params"]
  searchParamsPromise?: ProductPageProps["searchParams"]
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    paramsPromise,
    searchParamsPromise ?? Promise.resolve(emptySearchParams),
  ])
  const [audienceContext, product, session] = await Promise.all([
    resolveAudienceContext({ searchParams: resolvedSearchParams }),
    getCachedProductBySlug(slug),
    auth(),
  ])

  if (!product) {
    notFound()
  }

  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c"

  const [calculatorData, relatedSource, topProductIds] = await Promise.all([
    getProductCalculatorData({
      productId: product.id,
    }),
    product.category?.slug
      ? getRelatedProducts(
          product.category.slug,
          audienceContext.audience,
          product.id
        )
      : Promise.resolve([]),
    getTopProductIds(mode),
  ])
  const isTopProduct = topProductIds.includes(product.id)
  const relatedProducts = relatedSource
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
        isTopProduct,
      }}
      designerConfig={
        product.designerEnabled
          ? {
              enabled: true,
              width: product.designerWidth ?? 1050,
              height: product.designerHeight ?? 600,
              bgColor: product.designerBgColor ?? "#ffffff",
              dpi: product.designerDpi ?? 300,
              colorProfile: product.designerColorProfile ?? "CMYK",
            }
          : null
      }
      isLoggedIn={!!session?.user}
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
