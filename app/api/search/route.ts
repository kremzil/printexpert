import { NextRequest, NextResponse } from "next/server"

import { resolveAudienceContext } from "@/lib/audience-context"
import { getCatalogProducts, getCategories } from "@/lib/catalog"

const MIN_QUERY_LENGTH = 2
const MAX_LIMIT = 8

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get("q") ?? "").trim()
  const rawLimit = Number(searchParams.get("limit") ?? "6")
  const rawCategoryLimit = Number(searchParams.get("categoryLimit") ?? "4")
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : 6
  const categoryLimit = Number.isFinite(rawCategoryLimit)
    ? Math.min(Math.max(rawCategoryLimit, 0), MAX_LIMIT)
    : 4

  if (!query || query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({
      query,
      products: [],
      categories: [],
      total: 0,
    })
  }

  const audienceContext = await resolveAudienceContext({ request })
  const audience = audienceContext.audience

  const [catalogData, categories] = await Promise.all([
    getCatalogProducts({
      audience,
      query,
      sort: "relevance",
      page: 1,
      pageSize: limit,
    }),
    getCategories(),
  ])

  const visibleCategories = categories.filter((category) =>
    audience === "b2b" ? category.showInB2b !== false : category.showInB2c !== false
  )
  const loweredQuery = query.toLowerCase()
  const matchedCategories = visibleCategories
    .filter((category) => category.name.toLowerCase().includes(loweredQuery))
    .slice(0, categoryLimit)
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
    }))

  return NextResponse.json({
    query,
    products: catalogData.products,
    categories: matchedCategories,
    total: catalogData.total,
  })
}
