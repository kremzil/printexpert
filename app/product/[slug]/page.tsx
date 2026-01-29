import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { PriceCalculatorLetaky } from "@/components/product/price-calculator-letaky"
import { ProductGallery } from "@/components/product/product-gallery"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { resolveAudienceContext } from "@/lib/audience-context"
import { getProductBySlug } from "@/lib/catalog"
import { sanitizeHtml } from "@/lib/sanitize-html"
import { getWpCalculatorData } from "@/lib/wp-calculator"

type ProductPageProps = {
  params: Promise<{
    slug: string
  }>
  searchParams?: Promise<{
    mode?: string
  }>
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://printexpert.sk"

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params

  return {
    alternates: {
      canonical: new URL(`/product/${slug}`, siteUrl),
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
  const { slug } = await paramsPromise
  const resolvedSearchParams = searchParamsPromise
    ? await searchParamsPromise
    : {}
  const audienceContext = await resolveAudienceContext({
    searchParams: resolvedSearchParams,
  })
  const product = await getProductBySlug(slug)

  // enforce product visibility per audience preference
  if (audienceContext?.audience === "b2b" && product && product.showInB2b === false) {
    notFound()
  }
  if (audienceContext?.audience === "b2c" && product && product.showInB2c === false) {
    notFound()
  }

  if (!product) {
    notFound()
  }

  const calculatorData = product.wpProductId
    ? await getWpCalculatorData(product.wpProductId, true)
    : null

  const descriptionHtml = product.description
    ? sanitizeHtml(product.description)
    : null
  const priceQualifier = audienceContext.audience === "b2b" ? "bez DPH" : "s DPH"

  return (
    <section className="space-y-10">
      <Breadcrumb className="w-fit text-xs">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Domov</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/catalog">Katalóg</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{product.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-5xl font-semibold tracking-tight">{product.name}</h1>
            {product.excerpt ? (
              <div
                className="text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: product.excerpt }}
              />
            ) : null}
            {product.category ? (
              <Badge variant="secondary" className="w-fit">
                {product.category.name}
              </Badge>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Tento produkt vám radi pripravíme podľa vašich požiadaviek.
            </p>
          </div>

          {calculatorData ? (
            <PriceCalculatorLetaky data={calculatorData} productId={product.id} />
          ) : (
            <div className="space-y-2 rounded-xl border bg-card p-5 text-sm">
              {product.priceFrom ? (
                <div className="text-lg font-semibold">
                  Cena od {product.priceFrom.toString()} € {priceQualifier}
                </div>
              ) : (
                <div className="text-muted-foreground">Cena na vyžiadanie.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {descriptionHtml ? (
        <div className="space-y-4 pt-8 border-t">
          <h2 className="text-2xl font-semibold">Popis</h2>
          <div
            className="prose prose-neutral dark:prose-invert max-w-4xl [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_hr]:my-4 [&_hr]:border-border [&_mark]:rounded [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:bg-amber-200 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-md [&_iframe]:border-0 [&_video]:w-full [&_video]:rounded-md"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        </div>
      ) : null}
    </section>
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
