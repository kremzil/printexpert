import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Package } from "lucide-react"

import { ProductCard } from "@/components/product/product-card"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { getCollectionBySlug, getCollectionProducts } from "@/lib/catalog"
import { resolveAudienceContext } from "@/lib/audience-context"

type CollectionPageProps = {
  params: Promise<{
    slug: string
  }>
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://printexpert.sk"

export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params
  const audienceContext = await resolveAudienceContext()
  let collection: Awaited<ReturnType<typeof getCollectionBySlug>> = null
  try {
    collection = await getCollectionBySlug(slug, audienceContext.audience)
  } catch {
    collection = null
  }

  if (!collection) {
    return {
      title: "Kolekcia | PrintExpert",
      alternates: {
        canonical: new URL(`/kolekcie/${slug}`, siteUrl),
      },
    }
  }

  return {
    title: `${collection.name} | PrintExpert`,
    description:
      collection.description ??
      "Vybraná kolekcia tlačových produktov od PrintExpert.",
    alternates: {
      canonical: new URL(`/kolekcie/${collection.slug}`, siteUrl),
    },
  }
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params
  const audienceContext = await resolveAudienceContext()
  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c"
  const collection = await getCollectionBySlug(slug, audienceContext.audience)

  if (!collection) {
    notFound()
  }

  const products = await getCollectionProducts(
    collection.productIds,
    audienceContext.audience
  )

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <Breadcrumb className="w-fit text-xs">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Domov</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{collection.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <h1 className="text-2xl font-semibold md:text-3xl">{collection.name}</h1>
        {collection.description ? (
          <p className="max-w-3xl text-muted-foreground">{collection.description}</p>
        ) : null}
      </div>

      {products.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center">
          <Package className="mb-3 h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Žiadne dostupné produkty</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            V tejto kolekcii momentálne nie sú produkty dostupné pre zvolený režim.
          </p>
          <Link
            href="/catalog"
            className="mt-4 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Prejsť do katalógu
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} mode={mode} />
          ))}
        </div>
      )}
    </section>
  )
}
