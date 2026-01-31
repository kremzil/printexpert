import "server-only"

import { getPrisma } from "@/lib/prisma"

const SETTINGS_ID = "default"
const FALLBACK_VAT_RATE = 0.2
const FALLBACK_PRICES_INCLUDE_VAT = true

export type ShopSettings = {
  id: string
  vatRate: number
  pricesIncludeVat: boolean
}

export async function getShopSettings(): Promise<ShopSettings> {
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

export async function getShopVatRate() {
  const settings = await getShopSettings()
  return settings.vatRate
}

export async function getShopPriceIncludesVat() {
  const settings = await getShopSettings()
  return settings.pricesIncludeVat
}
