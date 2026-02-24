import { getCatalogFeedData } from "@/lib/feeds/catalog-feed"

export const revalidate = 1800
export const dynamic = "force-dynamic"

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

export async function GET() {
  const { items } = await getCatalogFeedData("google")

  const xmlItems = items
    .map(
      (item) => `
    <item>
      <g:id>${escapeXml(item.itemId)}</g:id>
      <title>${escapeXml(item.title)}</title>
      <description>${escapeXml(item.description)}</description>
      <link>${escapeXml(item.link)}</link>
      <g:image_link>${escapeXml(item.imageLink)}</g:image_link>
      <g:availability>${item.availability}</g:availability>
      <g:condition>${item.condition}</g:condition>
      <g:brand>${escapeXml(item.brand)}</g:brand>
      <g:price>${item.price.toFixed(2)} ${item.currency}</g:price>
    </item>`
    )
    .join("")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>PrintExpert Product Feed</title>
    <link>https://printexpert.sk</link>
    <description>Google Merchant feed</description>${xmlItems}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600",
    },
  })
}
