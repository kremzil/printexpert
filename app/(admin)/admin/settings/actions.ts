"use server"

import { revalidatePath, revalidateTag } from "next/cache"

import { getPrisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"
import { invalidateAllCatalog, TAGS } from "@/lib/cache-tags"

const SETTINGS_ID = "default"

export async function updateShopVatRate(formData: FormData) {
  await requireAdmin()

  const vatRateRaw = String(formData.get("vatRate") ?? "").trim()
  const pricesIncludeVatRaw = String(
    formData.get("pricesIncludeVat") ?? ""
  ).trim()
  if (!vatRateRaw) {
    return
  }

  const normalizedVatRate = vatRateRaw.replace(",", ".")
  const vatRateValue = Number(normalizedVatRate)
  if (Number.isNaN(vatRateValue)) {
    return
  }

  const pricesIncludeVat = pricesIncludeVatRaw === "1"

  const prisma = getPrisma()
  await prisma.shopSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, vatRate: normalizedVatRate, pricesIncludeVat },
    update: { vatRate: normalizedVatRate, pricesIncludeVat },
  })

  revalidateTag(TAGS.SHOP_SETTINGS, "max")
  revalidatePath("/admin/settings")
}

export async function revalidateCatalogCache() {
  await requireAdmin()
  invalidateAllCatalog()
}

export async function updateDpdSettings(formData: FormData) {
  await requireAdmin()

  const prisma = getPrisma()
  const existingSettings = await prisma.shopSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { dpdSettings: true },
  })
  const existingDpdSettings =
    (existingSettings?.dpdSettings as Record<string, unknown> | null) ?? {}
  const existingCourierPriceRaw = Number(existingDpdSettings.courierPrice ?? "4.99")
  const existingCourierPrice =
    Number.isFinite(existingCourierPriceRaw) && existingCourierPriceRaw >= 0
      ? existingCourierPriceRaw
      : 4.99
  const existingCourierFreeFromRaw = Number(existingDpdSettings.courierFreeFrom ?? "100")
  const existingCourierFreeFrom =
    Number.isFinite(existingCourierFreeFromRaw) && existingCourierFreeFromRaw >= 0
      ? existingCourierFreeFromRaw
      : 100
  const existingPickupPointEnabled =
    String(existingDpdSettings.pickupPointEnabled ?? "true") !== "false"

  await prisma.shopSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      dpdSettings: {
        delisId: String(formData.get("delisId") ?? "").trim(),
        clientEmail: String(formData.get("clientEmail") ?? "").trim(),
        apiKey: String(formData.get("apiKey") ?? "").trim(),
        bankAccountId: String(formData.get("bankAccountId") ?? "").trim(),
        senderAddressId: String(formData.get("senderAddressId") ?? "").trim(),
        defaultProduct: Number(formData.get("defaultProduct") ?? "1") || 1,
        courierPrice: existingCourierPrice,
        courierFreeFrom: existingCourierFreeFrom,
        pickupPointEnabled: existingPickupPointEnabled,
        notificationsEnabled: String(formData.get("notificationsEnabled") ?? "") === "1",
        notificationChannel:
          String(formData.get("notificationChannel") ?? "email") === "sms"
            ? "sms"
            : "email",
        notificationRule: ["1", "904", "902"].includes(
          String(formData.get("notificationRule") ?? "1")
        )
          ? String(formData.get("notificationRule")) 
          : "1",
        labelFormat:
          String(formData.get("labelFormat") ?? "A6") === "A4" ? "A4" : "A6",
        labelPosition: ["1", "2", "3", "4"].includes(
          String(formData.get("labelPosition") ?? "1")
        )
          ? String(formData.get("labelPosition"))
          : "1",
        mapWidgetEnabled: String(formData.get("mapWidgetEnabled") ?? "") === "1",
        mapApiKey: String(formData.get("mapApiKey") ?? "").trim(),
        mapLanguage:
          String(formData.get("mapLanguage") ?? "sk") === "en" ? "en" : "sk",
        pickupDateOffsetDays:
          Number(formData.get("pickupDateOffsetDays") ?? "1") || 1,
        pickupTimeFrom: String(formData.get("pickupTimeFrom") ?? "0800").trim(),
        pickupTimeTo: String(formData.get("pickupTimeTo") ?? "1600").trim(),
      },
    },
    update: {
      dpdSettings: {
        delisId: String(formData.get("delisId") ?? "").trim(),
        clientEmail: String(formData.get("clientEmail") ?? "").trim(),
        apiKey: String(formData.get("apiKey") ?? "").trim(),
        bankAccountId: String(formData.get("bankAccountId") ?? "").trim(),
        senderAddressId: String(formData.get("senderAddressId") ?? "").trim(),
        defaultProduct: Number(formData.get("defaultProduct") ?? "1") || 1,
        courierPrice: existingCourierPrice,
        courierFreeFrom: existingCourierFreeFrom,
        pickupPointEnabled: existingPickupPointEnabled,
        notificationsEnabled: String(formData.get("notificationsEnabled") ?? "") === "1",
        notificationChannel:
          String(formData.get("notificationChannel") ?? "email") === "sms"
            ? "sms"
            : "email",
        notificationRule: ["1", "904", "902"].includes(
          String(formData.get("notificationRule") ?? "1")
        )
          ? String(formData.get("notificationRule"))
          : "1",
        labelFormat:
          String(formData.get("labelFormat") ?? "A6") === "A4" ? "A4" : "A6",
        labelPosition: ["1", "2", "3", "4"].includes(
          String(formData.get("labelPosition") ?? "1")
        )
          ? String(formData.get("labelPosition"))
          : "1",
        mapWidgetEnabled: String(formData.get("mapWidgetEnabled") ?? "") === "1",
        mapApiKey: String(formData.get("mapApiKey") ?? "").trim(),
        mapLanguage:
          String(formData.get("mapLanguage") ?? "sk") === "en" ? "en" : "sk",
        pickupDateOffsetDays:
          Number(formData.get("pickupDateOffsetDays") ?? "1") || 1,
        pickupTimeFrom: String(formData.get("pickupTimeFrom") ?? "0800").trim(),
        pickupTimeTo: String(formData.get("pickupTimeTo") ?? "1600").trim(),
      },
    },
  })

  revalidateTag(TAGS.SHOP_SETTINGS, "max")
  revalidatePath("/admin/settings")
}

export async function updateDpdShippingPrice(formData: FormData) {
  await requireAdmin()

  const rawCourierPrice = Number(formData.get("courierPrice") ?? "4.99")
  const courierPrice =
    Number.isFinite(rawCourierPrice) && rawCourierPrice >= 0
      ? rawCourierPrice
      : 4.99
  const rawCourierFreeFrom = Number(formData.get("courierFreeFrom") ?? "100")
  const courierFreeFrom =
    Number.isFinite(rawCourierFreeFrom) && rawCourierFreeFrom >= 0
      ? rawCourierFreeFrom
      : 100
  const pickupPointEnabled = String(formData.get("pickupPointEnabled") ?? "") === "1"

  const prisma = getPrisma()
  const existingSettings = await prisma.shopSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { dpdSettings: true },
  })
  const existingDpdSettings =
    (existingSettings?.dpdSettings as Record<string, unknown> | null) ?? {}

  await prisma.shopSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      dpdSettings: {
        ...existingDpdSettings,
        courierPrice,
        courierFreeFrom,
        pickupPointEnabled,
      },
    },
    update: {
      dpdSettings: {
        ...existingDpdSettings,
        courierPrice,
        courierFreeFrom,
        pickupPointEnabled,
      },
    },
  })

  revalidateTag(TAGS.SHOP_SETTINGS, "max")
  revalidatePath("/admin/settings")
}

export async function updatePaymentMethods(formData: FormData) {
  await requireAdmin()
  const prisma = getPrisma()
  const cardEnabled = String(formData.get("cardEnabled") ?? "") === "1"
  const bankTransferEnabled = String(formData.get("bankTransferEnabled") ?? "") === "1"
  const codEnabled = String(formData.get("codEnabled") ?? "") === "1"
  await prisma.shopSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      paymentSettings: {
        cardEnabled,
        bankTransferEnabled,
        codEnabled,
        codForCourier: codEnabled,
        codForPickup: codEnabled,
      },
    },
    update: {
      paymentSettings: {
        cardEnabled,
        bankTransferEnabled,
        codEnabled,
        codForCourier: codEnabled,
        codForPickup: codEnabled,
      },
    },
  })

  revalidateTag(TAGS.SHOP_SETTINGS, "max")
  revalidatePath("/admin/settings")
}
