import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { getPrisma } from "@/lib/prisma"

const SETTINGS_ID = "default"
const FALLBACK_VAT_RATE = 0.2

export type ShopSettings = {
  id: string
  vatRate: number
}

export async function getShopSettings(): Promise<ShopSettings> {
  "use cache"
  cacheTag("shop-settings")
  cacheLife("hours")
  const prisma = getPrisma()
  const settings = await prisma.shopSettings.findUnique({
    where: { id: SETTINGS_ID },
  })

  if (!settings) {
    return { id: SETTINGS_ID, vatRate: FALLBACK_VAT_RATE }
  }

  return {
    id: settings.id,
    vatRate: Number(settings.vatRate.toString()),
  }
}

export async function getShopVatRate() {
  const settings = await getShopSettings()
  return settings.vatRate
}
