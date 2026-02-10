"use server"

import { revalidatePath, revalidateTag } from "next/cache"

import { getPrisma } from "@/lib/prisma"
import { sanitizeHtml } from "@/lib/sanitize-html"
import { requireAdmin } from "@/lib/auth-helpers"
import {
  invalidateProduct,
  invalidateCalculator,
  invalidateCategories,
  productTag,
} from "@/lib/cache-tags"

type UpdateMatrixPricesInput = {
  productId: string
  mtypeId: number
}

type CreateMatrixInput = {
  productId: string
  wpProductId: number | null
}

type DeleteMatrixInput = {
  productId: string
  mtypeId: number
}

type UpdateMatrixInput = {
  productId: string
  mtypeId: number
}

type UpdateMatrixVisibilityInput = {
  productId: string
  mtypeId: number
}

type UpdateProductWpIdInput = {
  productId: string
}

type UpdateProductDetailsInput = {
  productId: string
}

type AddProductImageInput = {
  productId: string
  url: string
}

type DeleteProductImageInput = {
  productId: string
  imageId: string
}

type SetProductImagePrimaryInput = {
  productId: string
  imageId: string
}

type ReorderProductImagesInput = {
  productId: string
  imageIds: string[]
}

// ...existing code...
type PhpSerializable =
  | string
  | number
  | null
  | PhpSerializableArray
  | PhpSerializableRecord

type PhpSerializableArray = PhpSerializable[]
interface PhpSerializableRecord { [key: string]: PhpSerializable }
// ...existing code...

const getByteLength = (value: string) => Buffer.byteLength(value, "utf8")

const phpSerialize = (value: PhpSerializable): string => {
  if (value === null) {
    return "N;"
  }

  if (Array.isArray(value)) {
    return `a:${value.length}:{${value
      .map((item, index) => `i:${index};${phpSerialize(item)}`)
      .join("")}}`
  }

  if (typeof value === "object") {
    const entries = Object.entries(value)
    return `a:${entries.length}:{${entries
      .map(([key, item]) => `${phpSerialize(String(key))}${phpSerialize(item)}`)
      .join("")}}`
  }

  if (typeof value === "number") {
    return `i:${Math.trunc(value)};`
  }

  const length = getByteLength(value)
  return `s:${length}:"${value}";`
}

const phpUnserialize = (input: string): PhpSerializable => {
  let idx = 0

  const readUntil = (char: string) => {
    const start = idx
    const end = input.indexOf(char, idx)
    if (end === -1) {
      throw new Error("Invalid serialization")
    }
    idx = end + 1
    return input.slice(start, end)
  }

  const parseValue = (): PhpSerializable => {
    const type = input[idx]
    idx += 2

    if (type === "N") {
      idx += 1
      return null
    }

    if (type === "i") {
      const num = readUntil(";")
      return Number(num)
    }

    if (type === "s") {
      const lenStr = readUntil(":")
      const len = Number(lenStr)
      if (input[idx] !== "\"") {
        throw new Error("Invalid string")
      }
      idx += 1
      const value = input.slice(idx, idx + len)
      idx += len
      if (input[idx] !== "\"") {
        throw new Error("Invalid string terminator")
      }
      idx += 2
      return value
    }

    if (type === "a") {
      const countStr = readUntil(":")
      const count = Number(countStr)
      if (input[idx] !== "{") {
        throw new Error("Invalid array start")
      }
      idx += 1
      const obj: Record<string, PhpSerializable> = {}
      for (let i = 0; i < count; i += 1) {
        const key = parseValue()
        const value = parseValue()
        obj[String(key)] = value
      }
      if (input[idx] !== "}") {
        throw new Error("Invalid array end")
      }
      idx += 1
      const keys = Object.keys(obj)
      const isSequential =
        keys.length > 0 && keys.every((key, i) => Number(key) === i)
      if (isSequential) {
        return keys.map((key) => obj[key])
      }
      return obj
    }

    throw new Error(`Unsupported type: ${type}`)
  }

  return parseValue()
}

const toStringArray = (value: PhpSerializable): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item))
  }
  if (typeof value === "object") {
    return Object.values(value).map((item) => String(item))
  }
  return []
}

const getBaseMatrixTerms = async (wpProductId: number) => {
  const prisma = getPrisma()
  const baseMatrix = await prisma.wpMatrixType.findFirst({
    where: { productId: wpProductId, mtype: 0 },
    orderBy: { sorder: "asc" },
    select: { attributes: true, aterms: true },
  })

  if (!baseMatrix?.attributes || !baseMatrix.aterms) {
    return { attributeIds: [] as string[], termsByAttribute: new Map<string, string[]>() }
  }

  const attributeIds = toStringArray(phpUnserialize(baseMatrix.attributes))
  const atermsMap = phpUnserialize(baseMatrix.aterms)
  if (!atermsMap || typeof atermsMap !== "object" || Array.isArray(atermsMap)) {
    return { attributeIds, termsByAttribute: new Map<string, string[]>() }
  }

  const termsByAttribute = new Map<string, string[]>()
  attributeIds.forEach((aid) => {
    const terms = toStringArray((atermsMap as Record<string, PhpSerializable>)[aid])
    if (terms.length > 0) {
      termsByAttribute.set(aid, terms)
    }
  })

  return {
    attributeIds: attributeIds.filter(
      (aid) => (termsByAttribute.get(aid)?.length ?? 0) > 0
    ),
    termsByAttribute,
  }
}

const buildCombinedTerms = (
  baseAttributeIds: string[],
  baseTermsByAttribute: Map<string, string[]>,
  attributeIds: string[],
  termsByAttribute: Map<string, string[]>
) => {
  const combinedAttributeIds: string[] = []
  const combinedTermsByAttribute = new Map<string, string[]>()
  const addAttribute = (aid: string, terms: string[]) => {
    if (!terms.length) return
    if (!combinedTermsByAttribute.has(aid)) {
      combinedAttributeIds.push(aid)
      combinedTermsByAttribute.set(aid, terms)
      return
    }
    const existing = new Set(combinedTermsByAttribute.get(aid) ?? [])
    terms.forEach((term) => existing.add(term))
    combinedTermsByAttribute.set(aid, Array.from(existing))
  }

  baseAttributeIds.forEach((aid) => {
    addAttribute(aid, baseTermsByAttribute.get(aid) ?? [])
  })
  attributeIds.forEach((aid) => {
    addAttribute(aid, termsByAttribute.get(aid) ?? [])
  })

  return { attributeIds: combinedAttributeIds, termsByAttribute: combinedTermsByAttribute }
}

export async function updateMatrixPrices(
  input: UpdateMatrixPricesInput,
  formData: FormData
) {
  const prisma = getPrisma()

  const updates: {
    aterms: string
    breakpoint: bigint
    price: string
  }[] = []

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("price|")) continue
    const rawPrice = String(value ?? "").trim()
    if (!rawPrice) continue
    const [, atermsEncoded, breakpointRaw] = key.split("|")
    if (!atermsEncoded || !breakpointRaw) continue
    updates.push({
      aterms: decodeURIComponent(atermsEncoded),
      breakpoint: BigInt(breakpointRaw),
      price: rawPrice,
    })
  }

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((entry) =>
        prisma.wpMatrixPrice.update({
          where: {
            mtypeId_aterms_number: {
              mtypeId: input.mtypeId,
              aterms: entry.aterms,
              number: entry.breakpoint,
            },
          },
          data: {
            price: entry.price,
          },
        })
      )
    )
  }

  invalidateCalculator(input.productId)
  revalidatePath(`/admin/products/${input.productId}`)
}

export async function createMatrix(
  input: CreateMatrixInput,
  formData: FormData
) {
  await requireAdmin()
  
  if (!input.wpProductId) {
    return
  }

  const prisma = getPrisma()
  const title = String(formData.get("title") ?? "").trim()
  const kind = String(formData.get("kind") ?? "simple").trim()
  const numTypeRaw = String(formData.get("numType") ?? "0").trim()
  const numStyleRaw = String(formData.get("numStyle") ?? "0").trim()
  const aUnitRaw = String(formData.get("aUnit") ?? "").trim()
  const numbers = String(formData.get("numbers") ?? "").trim()
  const termsByAttribute = new Map<string, Set<string>>()

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("terms:")) continue
    const aid = key.slice("terms:".length)
    const termId = String(value ?? "").trim()
    if (!aid || !termId) continue
    const set = termsByAttribute.get(aid) ?? new Set<string>()
    set.add(termId)
    termsByAttribute.set(aid, set)
  }

  const [maxMtype, maxOrder] = await Promise.all([
    prisma.wpMatrixType.findFirst({
      orderBy: { mtypeId: "desc" },
      select: { mtypeId: true },
    }),
    prisma.wpMatrixType.findFirst({
      where: { productId: input.wpProductId },
      orderBy: { sorder: "desc" },
      select: { sorder: true },
    }),
  ])

  const mtypeId = (maxMtype?.mtypeId ?? 0) + 1
  const sorder = (maxOrder?.sorder ?? 0) + 1
  const numType = Number.isNaN(Number(numTypeRaw)) ? 0 : Number(numTypeRaw)
  const numStyle = Number.isNaN(Number(numStyleRaw)) ? 0 : Number(numStyleRaw)
  const aUnit = aUnitRaw === "cm2" || aUnitRaw === "m2" ? aUnitRaw : null
  const attributes = Array.from(termsByAttribute.keys())
  const atermsEntries = attributes.reduce<Record<string, string[]>>(
    (acc, aid) => {
      acc[aid] = Array.from(termsByAttribute.get(aid) ?? [])
      return acc
    },
    {}
  )

  if (attributes.length === 0) {
    return
  }

  await prisma.wpMatrixType.create({
    data: {
      mtypeId,
      productId: input.wpProductId,
      mtype: kind === "finishing" ? 1 : 0,
      title: title || null,
      attributes: phpSerialize(attributes),
      aterms: phpSerialize(atermsEntries),
      numbers: numbers || null,
      numType,
      numStyle,
      aUnit,
      sorder,
    },
  })

  invalidateCalculator(input.productId)
  revalidatePath(`/admin/products/${input.productId}`)
}

export async function updateMatrix(
  input: UpdateMatrixInput,
  formData: FormData
) {
  const prisma = getPrisma()
  const existingMatrix = await prisma.wpMatrixType.findUnique({
    where: { mtypeId: input.mtypeId },
    select: { attributes: true, productId: true },
  })
  const title = String(formData.get("title") ?? "").trim()
  const kind = String(formData.get("kind") ?? "simple").trim()
  const numTypeRaw = String(formData.get("numType") ?? "0").trim()
  const numStyleRaw = String(formData.get("numStyle") ?? "0").trim()
  const aUnitRaw = String(formData.get("aUnit") ?? "").trim()
  const numbers = String(formData.get("numbers") ?? "").trim()
  const termsByAttribute = new Map<string, Set<string>>()
  const attributeOrder: string[] = []

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("terms:")) continue
    const aid = key.slice("terms:".length)
    const termId = String(value ?? "").trim()
    if (!aid || !termId) continue
    if (!attributeOrder.includes(aid)) {
      attributeOrder.push(aid)
    }
    const set = termsByAttribute.get(aid) ?? new Set<string>()
    set.add(termId)
    termsByAttribute.set(aid, set)
  }

  const numType = Number.isNaN(Number(numTypeRaw)) ? 0 : Number(numTypeRaw)
  const numStyle = Number.isNaN(Number(numStyleRaw)) ? 0 : Number(numStyleRaw)
  const aUnit = aUnitRaw === "cm2" || aUnitRaw === "m2" ? aUnitRaw : null
  const attributes = attributeOrder.length > 0
    ? attributeOrder
    : Array.from(termsByAttribute.keys())
  const atermsEntries = attributes.reduce<Record<string, string[]>>(
    (acc, aid) => {
      acc[aid] = Array.from(termsByAttribute.get(aid) ?? [])
      return acc
    },
    {}
  )

  if (attributes.length === 0) {
    return
  }

  const previousAttributes = existingMatrix?.attributes
    ? toStringArray(phpUnserialize(existingMatrix.attributes))
    : []
  const previousAttributeSet = new Set(previousAttributes)
  const nextAttributeSet = new Set(attributes)
  const attributesChanged =
    previousAttributeSet.size !== nextAttributeSet.size ||
    attributes.some((aid) => !previousAttributeSet.has(aid))

  await prisma.wpMatrixType.update({
    where: { mtypeId: input.mtypeId },
    data: {
      mtype: kind === "finishing" ? 1 : 0,
      title: title || null,
      attributes: phpSerialize(attributes),
      aterms: phpSerialize(atermsEntries),
      numbers: numbers || null,
      numType,
      numStyle,
      aUnit,
    },
  })

  const breakpoints = numbers
    .split(/[|,;\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value))
  const termsByAttributeList = new Map<string, string[]>()
  attributes.forEach((aid) => {
    const terms = Array.from(termsByAttribute.get(aid) ?? [])
    if (terms.length > 0) {
      termsByAttributeList.set(aid, terms)
    }
  })

  let comboAttributes = attributes
  let comboTermsByAttribute = termsByAttributeList
  if (kind === "finishing" && existingMatrix?.productId) {
    const baseData = await getBaseMatrixTerms(existingMatrix.productId)
    const combined = buildCombinedTerms(
      baseData.attributeIds,
      baseData.termsByAttribute,
      attributes,
      termsByAttributeList
    )
    comboAttributes = combined.attributeIds
    comboTermsByAttribute = combined.termsByAttribute
  }

  const termLists = comboAttributes.map((aid) => ({
    aid,
    terms: comboTermsByAttribute.get(aid) ?? [],
  }))
  const combinations: string[] = []
  const buildCombos = (index: number, current: string[]) => {
    if (index >= termLists.length) {
      combinations.push(current.join("-"))
      return
    }
    const { aid, terms } = termLists[index]
    terms.forEach((termId) => {
      buildCombos(index + 1, [...current, `${aid}:${termId}`])
    })
  }
  buildCombos(0, [])

  if (attributesChanged) {
    await prisma.wpMatrixPrice.deleteMany({
      where: { mtypeId: input.mtypeId },
    })
    if (breakpoints.length > 0 && combinations.length > 0) {
      await prisma.wpMatrixPrice.createMany({
        data: combinations.flatMap((aterms) =>
          breakpoints.map((number) => ({
            mtypeId: input.mtypeId,
            aterms,
            number: BigInt(number),
            price: "0",
          }))
        ),
        skipDuplicates: true,
      })
    }
  } else if (breakpoints.length > 0 && combinations.length > 0) {
    const existingCount = await prisma.wpMatrixPrice.count({
      where: { mtypeId: input.mtypeId },
    })
    if (existingCount > 0) {
      await prisma.wpMatrixPrice.createMany({
        data: combinations.flatMap((aterms) =>
          breakpoints.map((number) => ({
            mtypeId: input.mtypeId,
            aterms,
            number: BigInt(number),
            price: "0",
          }))
        ),
        skipDuplicates: true,
      })
    }
  }

  invalidateCalculator(input.productId)
  revalidatePath(`/admin/products/${input.productId}`)
}

export async function updateMatrixVisibility(
  input: UpdateMatrixVisibilityInput,
  formData: FormData
) {
  const rawValue = String(formData.get("isActive") ?? "0").trim()
  const isActive = rawValue === "1"
  const prisma = getPrisma()

  await prisma.wpMatrixType.update({
    where: { mtypeId: input.mtypeId },
    data: { isActive },
  })

  invalidateCalculator(input.productId)
  revalidatePath(`/admin/products/${input.productId}`)
}

export async function deleteMatrix(input: DeleteMatrixInput) {
  await requireAdmin()
  
  const prisma = getPrisma()

  await prisma.$transaction([
    prisma.wpMatrixPrice.deleteMany({
      where: { mtypeId: input.mtypeId },
    }),
    prisma.wpMatrixType.delete({
      where: { mtypeId: input.mtypeId },
    }),
  ])

  invalidateCalculator(input.productId)
  revalidatePath(`/admin/products/${input.productId}`)
}

export async function updateProductWpId(
  input: UpdateProductWpIdInput,
  formData: FormData
) {
  const rawWpProductId = String(formData.get("wpProductId") ?? "").trim()
  const wpProductId = rawWpProductId ? Number(rawWpProductId) : null

  if (rawWpProductId && Number.isNaN(wpProductId)) {
    return
  }

  const prisma = getPrisma()
  const updated = await prisma.product.update({
    where: { id: input.productId },
    data: { wpProductId },
    select: { slug: true },
  })

  revalidatePath(`/admin/products/${input.productId}`)
  if (updated?.slug) {
    invalidateProduct(updated.slug, input.productId)
    revalidatePath(`/product/${updated.slug}`)
  }
}

export async function updateProductDetails(
  input: UpdateProductDetailsInput,
  formData: FormData
) {
  await requireAdmin()
  
  const name = String(formData.get("name") ?? "").trim()
  const slug = String(formData.get("slug") ?? "").trim()
  const categoryId = String(formData.get("categoryId") ?? "").trim()
  const excerptInput = String(formData.get("excerpt") ?? "")
  const descriptionInput = String(formData.get("description") ?? "")
  const priceFromRaw = String(formData.get("priceFrom") ?? "").trim()
  const showInB2bRaw = String(formData.get("showInB2b") ?? "").trim()
  const showInB2cRaw = String(formData.get("showInB2c") ?? "").trim()
  const isActiveRaw = String(formData.get("isActive") ?? "").trim()

  // Designer fields
  const designerEnabledRaw = String(formData.get("designerEnabled") ?? "").trim()
  const designerWidthRaw = String(formData.get("designerWidth") ?? "").trim()
  const designerHeightRaw = String(formData.get("designerHeight") ?? "").trim()
  const designerBgColorRaw = String(formData.get("designerBgColor") ?? "").trim()
  const designerDpiRaw = String(formData.get("designerDpi") ?? "").trim()
  const designerColorProfile = String(formData.get("designerColorProfile") ?? "").trim()

  if (!name || !slug) {
    return
  }

  const normalizedPriceFrom = priceFromRaw.replace(",", ".")
  const priceFromValue = normalizedPriceFrom
    ? Number(normalizedPriceFrom)
    : null

  if (
    normalizedPriceFrom && Number.isNaN(priceFromValue)
  ) {
    return
  }

  const prisma = getPrisma()
  const sanitizedDescription = sanitizeHtml(descriptionInput)
  const description = sanitizedDescription.trim()
  const sanitizedExcerpt = sanitizeHtml(excerptInput)
  const excerpt = sanitizedExcerpt.trim()
  const existing = await prisma.product.findUnique({
    where: { id: input.productId },
    select: {
      slug: true,
      categoryId: true,
      isActive: true,
      showInB2b: true,
      showInB2c: true,
    },
  })

  if (!existing) {
    return
  }

  const nextIsActive = isActiveRaw === "1"
  const nextShowInB2b = showInB2bRaw === "1"
  const nextShowInB2c = showInB2cRaw === "1"

  const updated = await prisma.product.update({
    where: { id: input.productId },
    data: {
      name,
      slug,
      categoryId: categoryId || undefined,
      excerpt: excerpt || null,
      description: description || null,
      priceFrom: normalizedPriceFrom ? normalizedPriceFrom : null,
      isActive: nextIsActive,
      showInB2b: nextShowInB2b,
      showInB2c: nextShowInB2c,
      designerEnabled: designerEnabledRaw === "1",
      designerWidth: designerWidthRaw ? parseInt(designerWidthRaw) || null : null,
      designerHeight: designerHeightRaw ? parseInt(designerHeightRaw) || null : null,
      designerBgColor: designerBgColorRaw || null,
      designerDpi: designerDpiRaw ? parseInt(designerDpiRaw) || null : null,
      designerColorProfile: designerColorProfile || null,
    },
    select: { slug: true },
  })

  invalidateProduct(existing.slug, input.productId)
  if (updated.slug !== existing.slug) {
    revalidateTag(productTag(updated.slug), "max")
  }

  // Если сменилась категория, видимость или isActive — страховочный сброс
  // витринных страниц + навигации (counts могут измениться)
  const catalogChanged =
    (categoryId && categoryId !== existing.categoryId) ||
    nextIsActive !== existing.isActive ||
    nextShowInB2b !== existing.showInB2b ||
    nextShowInB2c !== existing.showInB2c

  if (catalogChanged) {
    invalidateCategories()
    revalidatePath("/kategorie")
    revalidatePath("/catalog")
  }

  revalidatePath("/admin")
  revalidatePath(`/admin/products/${input.productId}`)
  revalidatePath(`/product/${existing.slug}`)
  if (updated.slug !== existing.slug) {
    revalidatePath(`/product/${updated.slug}`)
  }
}

export async function createMatrixPriceRows(input: DeleteMatrixInput) {
  const prisma = getPrisma()
  const matrix = await prisma.wpMatrixType.findUnique({
    where: { mtypeId: input.mtypeId },
  })

  if (!matrix?.attributes || !matrix.aterms || !matrix.numbers) {
    return
  }

  const attributeIds = toStringArray(phpUnserialize(matrix.attributes))
  const atermsMap = phpUnserialize(matrix.aterms)
  if (
    !atermsMap ||
    typeof atermsMap !== "object" ||
    Array.isArray(atermsMap)
  ) {
    return
  }

  const breakpoints = matrix.numbers
    .split(/[|,;\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value))

  if (breakpoints.length === 0 || attributeIds.length === 0) {
    return
  }

  const termsByAttributeList = new Map<string, string[]>()
  attributeIds.forEach((aid) => {
    const terms = toStringArray((atermsMap as Record<string, PhpSerializable>)[aid])
    if (terms.length > 0) {
      termsByAttributeList.set(aid, terms)
    }
  })

  let comboAttributes = attributeIds
  let comboTermsByAttribute = termsByAttributeList
  if (matrix.mtype === 1) {
    const baseData = await getBaseMatrixTerms(matrix.productId)
    const combined = buildCombinedTerms(
      baseData.attributeIds,
      baseData.termsByAttribute,
      attributeIds,
      termsByAttributeList
    )
    comboAttributes = combined.attributeIds
    comboTermsByAttribute = combined.termsByAttribute
  }

  const termLists = comboAttributes.map((aid) => ({
    aid,
    terms: comboTermsByAttribute.get(aid) ?? [],
  }))

  const combinations: string[] = []
  const buildCombos = (index: number, current: string[]) => {
    if (index >= termLists.length) {
      combinations.push(current.join("-"))
      return
    }
    const { aid, terms } = termLists[index]
    terms.forEach((termId) => {
      buildCombos(index + 1, [...current, `${aid}:${termId}`])
    })
  }
  buildCombos(0, [])

  if (combinations.length === 0) {
    return
  }

  const rows = combinations.flatMap((aterms) =>
    breakpoints.map((number) => ({
      mtypeId: input.mtypeId,
      aterms,
      number: BigInt(number),
      price: "0",
    }))
  )

  await prisma.wpMatrixPrice.createMany({
    data: rows,
    skipDuplicates: true,
  })

  invalidateCalculator(input.productId)
  revalidatePath(`/admin/products/${input.productId}`)
}

export async function addProductImage(input: AddProductImageInput) {
  await requireAdmin()
  const prisma = getPrisma()

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { slug: true, images: { select: { id: true } } },
  })

  if (!product) return

  const isFirst = product.images.length === 0

  await prisma.productImage.create({
    data: {
      productId: input.productId,
      url: input.url,
      isPrimary: isFirst,
      sortOrder: product.images.length,
    },
  })

  invalidateProduct(product.slug)
  revalidatePath(`/admin/products/${input.productId}`)
  revalidatePath(`/product/${product.slug}`)
}

export async function deleteProductImage(input: DeleteProductImageInput) {
  await requireAdmin()
  const prisma = getPrisma()

  const image = await prisma.productImage.findUnique({
    where: { id: input.imageId },
    select: { isPrimary: true, productId: true },
  })

  if (!image || image.productId !== input.productId) return

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { slug: true },
  })

  await prisma.productImage.delete({
    where: { id: input.imageId },
  })

  // If deleted image was primary, make the first remaining image primary
  if (image.isPrimary) {
    const firstImage = await prisma.productImage.findFirst({
      where: { productId: input.productId },
      orderBy: { sortOrder: "asc" },
    })
    if (firstImage) {
      await prisma.productImage.update({
        where: { id: firstImage.id },
        data: { isPrimary: true },
      })
    }
  }

  if (product) {
    invalidateProduct(product.slug)
    revalidatePath(`/product/${product.slug}`)
  }
  revalidatePath(`/admin/products/${input.productId}`)
}

export async function setProductImagePrimary(input: SetProductImagePrimaryInput) {
  await requireAdmin()
  const prisma = getPrisma()

  const image = await prisma.productImage.findUnique({
    where: { id: input.imageId },
    select: { productId: true },
  })

  if (!image || image.productId !== input.productId) return

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { slug: true },
  })

  // Unset all other images as non-primary
  await prisma.productImage.updateMany({
    where: { productId: input.productId },
    data: { isPrimary: false },
  })

  // Set selected image as primary
  await prisma.productImage.update({
    where: { id: input.imageId },
    data: { isPrimary: true, sortOrder: 0 },
  })

  if (product) {
    invalidateProduct(product.slug)
    revalidatePath(`/product/${product.slug}`)
  }
  revalidatePath(`/admin/products/${input.productId}`)
}

export async function reorderProductImages(input: ReorderProductImagesInput) {
  await requireAdmin()
  const prisma = getPrisma()

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { slug: true },
  })

  if (!product) return

  // Update sortOrder for each image
  await Promise.all(
    input.imageIds.map((imageId, index) =>
      prisma.productImage.update({
        where: { id: imageId },
        data: { sortOrder: index },
      })
    )
  )

  invalidateProduct(product.slug)
  revalidatePath(`/admin/products/${input.productId}`)
  revalidatePath(`/product/${product.slug}`)
}
