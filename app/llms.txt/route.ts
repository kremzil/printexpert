import { getCategories, getHomepageCollections, getProducts } from "@/lib/catalog"
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, toAbsoluteUrl } from "@/lib/seo"

export const dynamic = "force-dynamic"

const PRODUCT_LIMIT = 300

const PUBLIC_PAGES: Array<{
  title: string
  path: string
  description: string
}> = [
  {
    title: "Domov",
    path: "/",
    description: "Hlavná vstupná stránka s ponukou tlačových služieb.",
  },
  {
    title: "Katalóg",
    path: "/catalog",
    description: "Prehľad všetkých produktov s filtráciou.",
  },
  {
    title: "Kategórie",
    path: "/kategorie",
    description: "Index všetkých kategórií produktov.",
  },
  {
    title: "Doprava",
    path: "/doprava",
    description: "Podmienky doručenia a odovzdania objednávok.",
  },
  {
    title: "Kontaktujte nás",
    path: "/kontaktujte-nas",
    description: "Kontaktné údaje a FAQ.",
  },
  {
    title: "Obchodné podmienky",
    path: "/obchodne-podmienky",
    description: "Právne podmienky nákupu.",
  },
  {
    title: "Ochrana osobných údajov",
    path: "/ochrana-osobnych-udajov",
    description: "GDPR a spracovanie osobných údajov.",
  },
  {
    title: "Vrátenie tovaru",
    path: "/vratenie-tovaru",
    description: "Informácie o reklamáciách a vrátení.",
  },
]

const PRIVATE_AREAS = [
  "/auth",
  "/account",
  "/checkout",
  "/checkout/success",
  "/checkout/cancel",
  "/admin",
  "/cart",
  "/dashboard",
]

const sanitizeText = (value: string | null | undefined) =>
  value ? value.replace(/\s+/g, " ").trim() : ""

export async function GET() {
  let categories: Awaited<ReturnType<typeof getCategories>> = []
  let collections: Awaited<ReturnType<typeof getHomepageCollections>> = []
  let products: Awaited<ReturnType<typeof getProducts>> = []

  try {
    ;[categories, collections, products] = await Promise.all([
      getCategories(),
      getHomepageCollections(),
      getProducts({}),
    ])
  } catch {
    // Keep static sections available even when dynamic sources are unavailable.
  }

  const visibleProducts = products.slice(0, PRODUCT_LIMIT)
  const generatedAt = new Date().toISOString()

  const lines = [
    `# ${SITE_NAME}`,
    `> ${SITE_DESCRIPTION}`,
    "",
    `Canonical: ${SITE_URL}`,
    `Generated: ${generatedAt}`,
    "",
    "## Public pages",
    ...PUBLIC_PAGES.map(
      (page) =>
        `- [${page.title}](${toAbsoluteUrl(page.path)}): ${page.description}`
    ),
    "",
    "## Categories",
    ...(categories.length > 0
      ? categories.map(
          (category) =>
            `- [${sanitizeText(category.name)}](${toAbsoluteUrl(`/kategorie/${category.slug}`)})`
        )
      : ["- (Žiadne kategórie)"]),
    "",
    "## Collections",
    ...(collections.length > 0
      ? collections.map(
          (collection) =>
            `- [${sanitizeText(collection.name)}](${toAbsoluteUrl(`/kolekcie/${collection.slug}`)})`
        )
      : ["- (Žiadne kolekcie)"]),
    "",
    `## Products (${visibleProducts.length}/${products.length})`,
    ...(visibleProducts.length > 0
      ? visibleProducts.map((product) => {
          const excerpt = sanitizeText(product.excerpt)
          const suffix = excerpt ? `: ${excerpt}` : ""
          return `- [${sanitizeText(product.name)}](${toAbsoluteUrl(`/product/${product.slug}`)})${suffix}`
        })
      : ["- (Žiadne produkty)"]),
    "",
    "## Noindex/private areas",
    ...PRIVATE_AREAS.map((path) => `- ${toAbsoluteUrl(path)}`),
    "",
    "## Technical endpoints",
    `- robots: ${toAbsoluteUrl("/robots.txt")}`,
    `- sitemap: ${toAbsoluteUrl("/sitemap.xml")}`,
  ]

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
    },
  })
}
