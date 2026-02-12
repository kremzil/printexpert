import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | string) {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(Number(price))
}

/**
 * Append a cache-busting `?v=` parameter to an image URL.
 * Uses the updatedAt timestamp so browsers fetch fresh images after content updates.
 */
export function versionedImageUrl(
  url: string,
  updatedAt?: Date | string | null,
): string {
  if (!updatedAt || !url) return url
  const ts =
    updatedAt instanceof Date
      ? updatedAt.getTime()
      : new Date(updatedAt).getTime()
  if (Number.isNaN(ts)) return url
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}v=${ts}`
}
