"use server"

import { revalidatePath, updateTag } from "next/cache"

import { getPrisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"

const SETTINGS_ID = "default"

export async function updateShopVatRate(formData: FormData) {
  await requireAdmin()

  const vatRateRaw = String(formData.get("vatRate") ?? "").trim()
  if (!vatRateRaw) {
    return
  }

  const normalizedVatRate = vatRateRaw.replace(",", ".")
  const vatRateValue = Number(normalizedVatRate)
  if (Number.isNaN(vatRateValue)) {
    return
  }

  const prisma = getPrisma()
  await prisma.shopSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, vatRate: normalizedVatRate },
    update: { vatRate: normalizedVatRate },
  })

  updateTag("shop-settings")
  revalidatePath("/admin/settings")
}
