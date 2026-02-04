"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAuth } from "@/lib/auth-helpers"
import { getPrisma } from "@/lib/prisma"

const getString = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : ""

const toOptionalString = (value: FormDataEntryValue | null) => {
  const normalized = getString(value)
  return normalized ? normalized : null
}

const toBoolean = (value: FormDataEntryValue | null) =>
  value === "on" || value === "1" || value === "true"

export async function createAddress(formData: FormData) {
  const session = await requireAuth()
  if (!session?.user?.id) {
    redirect("/auth")
  }

  const label = getString(formData.get("label"))
  const street = getString(formData.get("street"))
  const city = getString(formData.get("city"))
  const zipCode = getString(formData.get("zipCode"))
  const country = getString(formData.get("country"))
  const apt = toOptionalString(formData.get("apt"))
  const isDefault = toBoolean(formData.get("isDefault"))

  if (!label || !street || !city || !zipCode || !country) {
    return
  }

  const prisma = getPrisma()
  const existingCount = await prisma.userAddress.count({
    where: { userId: session.user.id },
  })

  const shouldBeDefault = isDefault || existingCount === 0

  await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.userAddress.updateMany({
        where: { userId: session.user.id },
        data: { isDefault: false },
      })
    }

    await tx.userAddress.create({
      data: {
        userId: session.user.id,
        label,
        street,
        city,
        zipCode,
        country,
        apt,
        isDefault: shouldBeDefault,
      },
    })
  })

  revalidatePath("/account/addresses")
  redirect("/account/addresses")
}

export async function updateAddress(formData: FormData) {
  const session = await requireAuth()
  if (!session?.user?.id) {
    redirect("/auth")
  }

  const id = getString(formData.get("id"))
  const label = getString(formData.get("label"))
  const street = getString(formData.get("street"))
  const city = getString(formData.get("city"))
  const zipCode = getString(formData.get("zipCode"))
  const country = getString(formData.get("country"))
  const apt = toOptionalString(formData.get("apt"))
  const isDefault = toBoolean(formData.get("isDefault"))

  if (!id || !label || !street || !city || !zipCode || !country) {
    return
  }

  const prisma = getPrisma()
  const address = await prisma.userAddress.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })

  if (!address) {
    redirect("/account/addresses")
  }

  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.userAddress.updateMany({
        where: { userId: session.user.id },
        data: { isDefault: false },
      })
    }

    await tx.userAddress.update({
      where: { id },
      data: {
        label,
        street,
        city,
        zipCode,
        country,
        apt,
        isDefault,
      },
    })
  })

  revalidatePath("/account/addresses")
  redirect("/account/addresses")
}

export async function deleteAddress(formData: FormData) {
  const session = await requireAuth()
  if (!session?.user?.id) {
    redirect("/auth")
  }

  const id = getString(formData.get("id"))
  if (!id) {
    return
  }

  const prisma = getPrisma()
  const address = await prisma.userAddress.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, isDefault: true },
  })

  if (!address) {
    redirect("/account/addresses")
  }

  await prisma.userAddress.delete({
    where: { id },
  })

  if (address.isDefault) {
    const fallback = await prisma.userAddress.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    })

    if (fallback) {
      await prisma.userAddress.update({
        where: { id: fallback.id },
        data: { isDefault: true },
      })
    }
  }

  revalidatePath("/account/addresses")
}

export async function setDefaultAddress(formData: FormData) {
  const session = await requireAuth()
  if (!session?.user?.id) {
    redirect("/auth")
  }

  const id = getString(formData.get("id"))
  if (!id) {
    return
  }

  const prisma = getPrisma()
  const address = await prisma.userAddress.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })

  if (!address) {
    redirect("/account/addresses")
  }

  await prisma.$transaction([
    prisma.userAddress.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    }),
    prisma.userAddress.update({
      where: { id },
      data: { isDefault: true },
    }),
  ])

  revalidatePath("/account/addresses")
}
