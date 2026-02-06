import "server-only"

import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma"

const SETTINGS_ID = "default"
const FALLBACK_VAT_RATE = 0.2
const FALLBACK_PRICES_INCLUDE_VAT = true

export type ShopSettings = {
  id: string
  vatRate: number
  pricesIncludeVat: boolean
}

const fetchShopSettings = async (): Promise<ShopSettings> => {
  const prisma = getPrisma()
  const settings = await prisma.shopSettings.findUnique({
    where: { id: SETTINGS_ID },
  })

  if (!settings) {
    return {
      id: SETTINGS_ID,
      vatRate: FALLBACK_VAT_RATE,
      pricesIncludeVat: FALLBACK_PRICES_INCLUDE_VAT,
    }
  }

  return {
    id: settings.id,
    vatRate: Number(settings.vatRate.toString()),
    pricesIncludeVat: settings.pricesIncludeVat,
  }
}

const getCachedShopSettings = unstable_cache(
  fetchShopSettings,
  ["shop-settings"],
  { revalidate: 300, tags: ["shop-settings"] }
)

export async function getShopSettings(): Promise<ShopSettings> {
  return getCachedShopSettings()
}

export async function getShopVatRate() {
  const settings = await getShopSettings()
  return settings.vatRate
}

export async function getShopPriceIncludesVat() {
  const settings = await getShopSettings()
  return settings.pricesIncludeVat
}
