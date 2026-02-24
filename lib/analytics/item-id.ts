export const buildMarketingItemId = (
  productId: string,
  wpProductId?: number | null
) => {
  if (typeof wpProductId === "number" && Number.isFinite(wpProductId)) {
    return String(wpProductId)
  }
  return `nx_${productId}`
}
