import type { MetadataRoute } from "next"

import {
  getCategories,
  getHomepageCollections,
  getProducts,
} from "@/lib/catalog"
import { toAbsoluteUrl } from "@/lib/seo"

const STATIC_ROUTES = [
  "/",
  "/catalog",
  "/kategorie",
  "/doprava",
  "/kontaktujte-nas",
  "/obchodne-podmienky",
  "/ochrana-osobnych-udajov",
  "/vratenie-tovaru",
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: toAbsoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }))

  let products: Awaited<ReturnType<typeof getProducts>> = []
  let categories: Awaited<ReturnType<typeof getCategories>> = []
  let collections: Awaited<ReturnType<typeof getHomepageCollections>> = []

  try {
    ;[products, categories, collections] = await Promise.all([
      getProducts({}),
      getCategories(),
      getHomepageCollections(),
    ])
  } catch {
    return staticEntries
  }

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: toAbsoluteUrl(`/product/${product.slug}`),
    lastModified:
      product.updatedAt instanceof Date
        ? product.updatedAt
        : product.updatedAt
          ? new Date(product.updatedAt)
          : now,
    changeFrequency: "weekly",
    priority: 0.9,
  }))

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: toAbsoluteUrl(`/kategorie/${category.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  const collectionEntries: MetadataRoute.Sitemap = collections.map(
    (collection) => ({
      url: toAbsoluteUrl(`/kolekcie/${collection.slug}`),
      lastModified:
        collection.updatedAt instanceof Date
          ? collection.updatedAt
          : collection.updatedAt
            ? new Date(collection.updatedAt)
            : now,
      changeFrequency: "weekly",
      priority: 0.7,
    })
  )

  return [
    ...staticEntries,
    ...categoryEntries,
    ...collectionEntries,
    ...productEntries,
  ]
}
