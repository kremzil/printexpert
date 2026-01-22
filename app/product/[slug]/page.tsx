import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { PriceCalculatorLetaky } from "@/components/product/price-calculator-letaky"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { getProductBySlug } from "@/lib/catalog"
import { getWpCalculatorData } from "@/lib/wp-calculator"

type ProductPageProps = {
  params: Promise<{
    slug: string
  }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    notFound()
  }

  const primaryImage = product.images[0]
  const calculatorData = product.wpProductId
    ? await getWpCalculatorData(product.wpProductId)
    : null

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

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <div className="relative aspect-4/5 w-full overflow-hidden rounded-xl border bg-muted/30">
            <Image
              src={primaryImage.url}
              alt={primaryImage.alt ?? product.name}
              fill
              className="object-contain"
              sizes="(min-width: 1024px) 560px, 100vw"
            />
          </div>
          {product.images.length > 1 ? (
            <div className="grid grid-cols-4 gap-3">
              {product.images.slice(0, 4).map((image, index) => (
                <div
                  key={`${image.url}-${index}`}
                  className="relative aspect-square overflow-hidden rounded-md border bg-muted/30"
                >
                  <Image
                    src={image.url}
                    alt={image.alt ?? product.name}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 120px, 25vw"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
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
            <PriceCalculatorLetaky data={calculatorData} />
          ) : (
            <div className="space-y-2 rounded-xl border bg-card p-5 text-sm">
              {product.priceFrom ? (
                <div className="text-lg font-semibold">
                  Cena od {product.priceFrom.toString()} €
                </div>
              ) : (
                <div className="text-muted-foreground">Cena na vyžiadanie.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {product.description ? (
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold">Popis</h2>
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        </div>
      ) : null}
    </section>
  )
}
