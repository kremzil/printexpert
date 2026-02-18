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
  dpdSettings: DpdSettings
  paymentSettings: PaymentSettings
}

export type DpdSettings = {
  delisId: string
  clientEmail: string
  apiKey: string
  bankAccountId: string
  senderAddressId: string
  defaultProduct: number
  notificationsEnabled: boolean
  notificationChannel: "email" | "sms"
  notificationRule: "1" | "904" | "902"
  labelFormat: "A4" | "A6"
  labelPosition: "1" | "2" | "3" | "4"
  mapWidgetEnabled: boolean
  mapApiKey: string
  mapLanguage: "sk" | "en"
  pickupDateOffsetDays: number
  pickupTimeFrom: string
  pickupTimeTo: string
}

export type PaymentSettings = {
  cardEnabled: boolean
  bankTransferEnabled: boolean
  codEnabled: boolean
  codForCourier: boolean
  codForPickup: boolean
}

const FALLBACK_DPD_SETTINGS: DpdSettings = {
  delisId: "",
  clientEmail: "",
  apiKey: "",
  bankAccountId: "",
  senderAddressId: "",
  defaultProduct: 1,
  notificationsEnabled: false,
  notificationChannel: "email",
  notificationRule: "1",
  labelFormat: "A6",
  labelPosition: "1",
  mapWidgetEnabled: false,
  mapApiKey: "",
  mapLanguage: "sk",
  pickupDateOffsetDays: 1,
  pickupTimeFrom: "0800",
  pickupTimeTo: "1600",
}

const FALLBACK_PAYMENT_SETTINGS: PaymentSettings = {
  cardEnabled: true,
  bankTransferEnabled: true,
  codEnabled: true,
  codForCourier: true,
  codForPickup: true,
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
      dpdSettings: FALLBACK_DPD_SETTINGS,
      paymentSettings: FALLBACK_PAYMENT_SETTINGS,
    }
  }

  const dpdSettings = {
    ...FALLBACK_DPD_SETTINGS,
    ...((settings.dpdSettings as Record<string, unknown> | null) ?? {}),
  } satisfies DpdSettings

  const paymentSettings = {
    ...FALLBACK_PAYMENT_SETTINGS,
    ...((settings.paymentSettings as Record<string, unknown> | null) ?? {}),
  } satisfies PaymentSettings

  return {
    id: settings.id,
    vatRate: Number(settings.vatRate.toString()),
    pricesIncludeVat: settings.pricesIncludeVat,
    dpdSettings,
    paymentSettings,
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

export async function getDpdSettings() {
  const settings = await getShopSettings()
  return settings.dpdSettings
}

export async function getPaymentSettings() {
  const settings = await getShopSettings()
  return settings.paymentSettings
}
