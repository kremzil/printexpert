import fs from "fs"
import path from "path"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent } from "@/components/ui/card"
import { PriceCalculatorLetaky } from "@/components/product/price-calculator-letaky"
import { getProductBySlug } from "@/lib/catalog"

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
  const calculatorFileBySlug: Record<string, string> = {
    letaky: "wp2print_dom_export_1424.json",
    "samolepiaca-folia": "wp2print_dom_export_1440.json",
  }
  const calculatorFile = calculatorFileBySlug[slug]
  const calculatorData = calculatorFile
    ? JSON.parse(
        fs.readFileSync(
          path.join(process.cwd(), "data", "wp", calculatorFile),
          "utf8"
        )
      )
    : null

  return (
    <section className="space-y-6">
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border">
          <Image
            src={primaryImage.url}
            alt={primaryImage.alt ?? product.name}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 520px, 100vw"
          />
        </div>
        <Card className="py-6">
          <CardContent className="space-y-3">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            {product.category ? (
              <Badge variant="secondary" className="w-fit">
                {product.category.name}
              </Badge>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Tento produkt vám radi pripravíme podľa vašich požiadaviek.
            </p>
            {product.priceFrom ? (
              <div className="text-lg font-semibold">{product.priceFrom.toString()} €</div>
            ) : (
              <div className="text-sm text-muted-foreground">Cena na vyžiadanie</div>
            )}
          </CardContent>
        </Card>
      </div>
      {calculatorData ? <PriceCalculatorLetaky data={calculatorData} /> : null}
    </section>
  )
}
