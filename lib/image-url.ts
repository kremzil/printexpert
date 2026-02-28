const DEFAULT_PRODUCTS_CDN_BASE_URL = "https://cdn.printexpert.sk"

const resolveProductsCdnBaseUrl = () =>
  (process.env.NEXT_PUBLIC_PRODUCTS_CDN_BASE_URL || DEFAULT_PRODUCTS_CDN_BASE_URL)
    .trim()
    .replace(/\/+$/, "")

export function resolveProductImageUrl(value: string | null | undefined) {
  const raw = String(value || "").trim()
  if (!raw) return ""

  const cdnBaseUrl = resolveProductsCdnBaseUrl()

  if (raw.startsWith("/products/")) {
    return `${cdnBaseUrl}${raw}`
  }

  if (raw.startsWith("products/")) {
    return `${cdnBaseUrl}/${raw}`
  }

  try {
    const parsed = new URL(raw)
    if (parsed.pathname.startsWith("/products/")) {
      return `${cdnBaseUrl}${parsed.pathname}`
    }
  } catch {
    // Not an absolute URL; use as-is.
  }

  return raw
}
