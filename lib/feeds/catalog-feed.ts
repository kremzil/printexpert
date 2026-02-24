import "server-only"

import type { AudienceContext } from "@/lib/audience-shared"
import { buildMarketingItemId } from "@/lib/analytics/item-id"
import { logger } from "@/lib/observability/logger"
import { calculate } from "@/lib/pricing"
import { getPrisma } from "@/lib/prisma"
import { DEFAULT_OG_IMAGE, SITE_NAME, toAbsoluteUrl } from "@/lib/seo"

type FeedProductDiagnostics = {
  id: string
  slug: string
  reason: string
}

type FeedProduct = {
  id: string
  itemId: string
  slug: string
  title: string
  description: string
  link: string
  imageLink: string
  availability: "in stock"
  condition: "new"
  brand: string
  price: number
  currency: "EUR"
  categoryName: string | null
}

const FEED_AUDIENCE_CONTEXT: AudienceContext = {
  audience: "b2c",
  mode: "b2c",
  source: "default",
}

const round2 = (value: number) => Math.round(value * 100) / 100

const toPlainText = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const resolvePriceFromDb = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const parsed = Number(String(value))
  return Number.isFinite(parsed) && parsed > 0 ? round2(parsed) : null
}

const resolveProductPrice = async (product: {
  id: string
  priceAfterDiscountFrom: unknown
  priceFrom: unknown
  areaMinQuantity: number | null
  areaMinWidth: unknown
  areaMinHeight: unknown
}) => {
  const dbPrice =
    resolvePriceFromDb(product.priceAfterDiscountFrom) ??
    resolvePriceFromDb(product.priceFrom)
  if (dbPrice !== null) {
    return dbPrice
  }

  const toNumberOrNull = (value: unknown) => {
    if (value === null || value === undefined) return null
    const parsed = Number(String(value))
    return Number.isFinite(parsed) ? parsed : null
  }

  const fallbackQuantity =
    product.areaMinQuantity && product.areaMinQuantity > 0
      ? product.areaMinQuantity
      : 1

  try {
    const calculated = await calculate(
      product.id,
      {
        quantity: fallbackQuantity,
        width: toNumberOrNull(product.areaMinWidth),
        height: toNumberOrNull(product.areaMinHeight),
      },
      FEED_AUDIENCE_CONTEXT
    )
    return round2(calculated.gross)
  } catch {
    return null
  }
}

export const getCatalogFeedData = async (feedType: "google" | "meta") => {
  const prisma = getPrisma()
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      wpProductId: true,
      name: true,
      excerpt: true,
      description: true,
      priceFrom: true,
      priceAfterDiscountFrom: true,
      areaMinQuantity: true,
      areaMinWidth: true,
      areaMinHeight: true,
      category: {
        select: {
          name: true,
        },
      },
      images: {
        take: 1,
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        select: {
          url: true,
        },
      },
    },
  })

  const diagnostics: FeedProductDiagnostics[] = []
  const items: FeedProduct[] = []

  for (const product of products) {
    const price = await resolveProductPrice(product)
    if (price === null) {
      diagnostics.push({
        id: product.id,
        slug: product.slug,
        reason: "missing_price",
      })
      continue
    }

    const description = toPlainText(product.excerpt ?? product.description)
    items.push({
      id: product.id,
      itemId: buildMarketingItemId(product.id, product.wpProductId),
      slug: product.slug,
      title: toPlainText(product.name) || product.slug,
      description:
        description || "Profesionálna tlač na mieru od PrintExpert.",
      link: toAbsoluteUrl(`/product/${product.slug}`),
      imageLink: toAbsoluteUrl(product.images[0]?.url ?? DEFAULT_OG_IMAGE),
      availability: "in stock",
      condition: "new",
      brand: SITE_NAME,
      price,
      currency: "EUR",
      categoryName: product.category?.name ?? null,
    })
  }

  if (diagnostics.length > 0) {
    logger.warn({
      event: "catalog.feed.skipped_products",
      feedType,
      skippedCount: diagnostics.length,
      skippedPreview: diagnostics.slice(0, 50),
    })
  }

  return { items, diagnostics }
}
