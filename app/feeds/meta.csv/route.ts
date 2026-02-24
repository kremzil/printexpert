import { getCatalogFeedData } from "@/lib/feeds/catalog-feed"

export const revalidate = 1800
export const dynamic = "force-dynamic"

const escapeCsvCell = (value: string | number) => {
  const normalized = String(value).replace(/"/g, '""')
  return `"${normalized}"`
}

export async function GET() {
  const { items } = await getCatalogFeedData("meta")

  const header = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "brand",
  ]

  const rows = items.map((item) => [
    item.itemId,
    item.title,
    item.description,
    item.availability,
    item.condition,
    `${item.price.toFixed(2)} ${item.currency}`,
    item.link,
    item.imageLink,
    item.brand,
  ])

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n")

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600",
    },
  })
}
