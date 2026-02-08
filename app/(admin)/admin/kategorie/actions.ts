"use server"

import { revalidatePath, revalidateTag, updateTag } from "next/cache"

import { getPrisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"

type UpdateCategoryInput = {
  categoryId: string
}

type DeleteCategoryInput = {
  categoryId: string
}

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")

const parseSortOrder = (value: string | null, fallback: number) => {
  const parsed = Number(value ?? "")
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function createCategory(formData: FormData) {
  await requireAdmin()
  
  const prisma = getPrisma()
  const name = String(formData.get("name") ?? "").trim()
  const slugRaw = String(formData.get("slug") ?? "").trim()
  const image = String(formData.get("image") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const parentIdRaw = String(formData.get("parentId") ?? "").trim()
  const sortOrder = parseSortOrder(String(formData.get("sortOrder") ?? "0"), 0)
  const isActive = formData.get("isActive") === "1"
  const showInB2b = formData.get("showInB2b") === "1"
  const showInB2c = formData.get("showInB2c") === "1"

  if (!name || !image) {
    return
  }

  const slug = normalizeSlug(slugRaw || name)
  if (!slug) {
    return
  }

  const existing = await prisma.category.findUnique({ where: { slug } })
  if (existing) {
    return
  }

  const parentId = parentIdRaw && parentIdRaw !== "none" ? parentIdRaw : null

  await prisma.category.create({
    data: {
      name,
      slug,
      image,
      description: description || null,
      sortOrder,
      isActive,
      showInB2b,
      showInB2c,
      parentId,
    },
  })

  updateTag("categories")
  updateTag(`category:${slug}`)
  revalidatePath("/kategorie")
  revalidatePath("/catalog")
  revalidatePath("/admin/kategorie")
  revalidateTag("nav-data", "max")
  revalidateTag("catalog-data", "max")
  revalidateTag("top-products", "max")
}

export async function updateCategory(
  input: UpdateCategoryInput,
  formData: FormData
) {
  await requireAdmin()
  const prisma = getPrisma()
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
  })

  if (!category) {
    return
  }

  const name = String(formData.get("name") ?? "").trim() || category.name
  const slugRaw = String(formData.get("slug") ?? "").trim()
  const imageRaw = String(formData.get("image") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const parentIdRaw = String(formData.get("parentId") ?? "").trim()
  const sortOrder = parseSortOrder(
    String(formData.get("sortOrder") ?? ""),
    category.sortOrder
  )
  const isActive = formData.get("isActive") === "1"
  const showInB2b = formData.get("showInB2b") === "1"
  const showInB2c = formData.get("showInB2c") === "1"

  const nextSlug = slugRaw ? normalizeSlug(slugRaw) : category.slug
  if (!nextSlug) {
    return
  }

  if (nextSlug !== category.slug) {
    const existing = await prisma.category.findUnique({
      where: { slug: nextSlug },
    })
    if (existing) {
      return
    }
  }

  const parentId =
    parentIdRaw && parentIdRaw !== "none" && parentIdRaw !== category.id
      ? parentIdRaw
      : null

  await prisma.category.update({
    where: { id: category.id },
    data: {
      name,
      slug: nextSlug,
      image: imageRaw || category.image,
      description: description || null,
      sortOrder,
      isActive,
      showInB2b,
      showInB2c,
      parentId,
    },
  })

  updateTag("categories")
  updateTag(`category:${category.slug}`)
  updateTag(`category:${nextSlug}`)
  revalidatePath("/kategorie")
  revalidatePath("/catalog")
  revalidatePath("/admin/kategorie")
  revalidateTag("nav-data", "max")
  revalidateTag("catalog-data", "max")
  revalidateTag("top-products", "max")
}

export async function deleteCategory(input: DeleteCategoryInput) {
  await requireAdmin()
  const prisma = getPrisma()
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: {
      id: true,
      slug: true,
      _count: { select: { products: true, children: true } },
    },
  })

  if (!category) {
    return
  }

  if (category._count.products > 0 || category._count.children > 0) {
    return
  }

  await prisma.category.delete({ where: { id: category.id } })

  updateTag("categories")
  updateTag(`category:${category.slug}`)
  revalidatePath("/kategorie")
  revalidatePath("/catalog")
  revalidatePath("/admin/kategorie")
  revalidateTag("nav-data", "max")
  revalidateTag("catalog-data", "max")
  revalidateTag("top-products", "max")
}
