import { withObservedRoute } from "@/lib/observability/with-observed-route";
import { NextResponse } from "next/server"
import type { Prisma, PriceType } from "@/lib/generated/prisma"
import { revalidatePath } from "next/cache"
import { invalidateAllCatalog } from "@/lib/cache-tags"
import path from "path"
import sharp from "sharp"
import { PutObjectCommand } from "@aws-sdk/client-s3"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sanitizeHtml } from "@/lib/sanitize-html"
import { getS3Client, getS3Config } from "@/lib/s3"

const MAX_ROWS = 5000
const DEFAULT_CATEGORY_IMAGE = "/categories/velke-formaty.webp"
const PRODUCTS_PREFIX = "products"
const DEFAULT_PRODUCTS_CDN_BASE_URL = "https://cdn.printexpert.sk"

type MappingRow = {
  csvColumn: string
  field: string
}

type ImportResult = {
  created: number
  updated: number
  skipped: number
  failed: number
  errors: string[]
}

type CategoryRecord = {
  id: string
  slug: string
  name: string
  image: string
  parentId: string | null
}

const parseBoolean = (value: string | null | undefined) => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (["1", "true", "yes", "y", "áno", "ano"].includes(normalized)) return true
  if (["0", "false", "no", "n", "nie"].includes(normalized)) return false
  return null
}

const parseDecimal = (value: string | null | undefined) => {
  if (!value) return null
  const normalized = value.replace(",", ".").trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

type DecimalParseResult =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "value"; value: number }

const parseDecimalDetailed = (value: string | null | undefined): DecimalParseResult => {
  if (value === null || value === undefined) {
    return { kind: "empty" }
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return { kind: "empty" }
  }

  const withoutSpaces = trimmed.replace(/\u00A0/g, " ").replace(/\s+/g, "")
  const withoutCurrency = withoutSpaces.replace(/[€$]/g, "").replace(/'/g, "")

  let normalized = withoutCurrency
  const hasComma = normalized.includes(",")
  const hasDot = normalized.includes(".")

  if (hasComma && hasDot) {
    const commaIndex = normalized.lastIndexOf(",")
    const dotIndex = normalized.lastIndexOf(".")
    normalized =
      commaIndex > dotIndex
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "")
  } else if (hasComma) {
    normalized = normalized.replace(",", ".")
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return { kind: "invalid" }
  }

  return { kind: "value", value: parsed }
}

const parseInteger = (value: string | null | undefined) => {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

const parseNumberWithFallback = (value: FormDataEntryValue | null, fallback: number) => {
  if (value === null) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseDefaults = (value: string | null) => {
  if (!value) return {}
  const entries = value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)

  const result: Record<string, string> = {}
  for (const entry of entries) {
    const [key, ...rest] = entry.split("=")
    if (!key || rest.length === 0) continue
    result[key.trim()] = rest.join("=").trim()
  }
  return result
}

const sanitizeFolder = (value: string) => {
  if (!value) return ""
  const parts = value
    .split(/[\\/]+/)
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => part.replace(/[^a-zA-Z0-9-_]/g, ""))
    .filter(Boolean)
  return parts.join("/")
}

const sanitizeFileName = (value: string) => {
  if (!value) return ""
  const normalized = value.trim().replace(/\\/g, "/")
  const fileName = normalized.split("/").pop() ?? ""
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "")
}

const buildProductsPublicUrl = (objectKey: string) => {
  const configuredBase = (
    process.env.PRODUCTS_CDN_BASE_URL ||
    process.env.NEXT_PUBLIC_PRODUCTS_CDN_BASE_URL ||
    DEFAULT_PRODUCTS_CDN_BASE_URL
  )
    .trim()
    .replace(/\/+$/, "")

  if (!configuredBase) {
    return `/${objectKey}`
  }

  return `${configuredBase}/${objectKey}`
}

async function downloadAndProcessImage(options: {
  imageUrl: string
  productId: string
  folder: string
  width: number
  quality: number
  fileName: string
}) {
  const response = await fetch(options.imageUrl)
  if (!response.ok) {
    throw new Error(`Nepodarilo sa stiahnuť obrázok (${response.status}).`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const safeProductId = options.productId.replace(/[^a-zA-Z0-9-_]/g, "")
  if (!safeProductId) {
    throw new Error("Neplatné ID produktu pre cestu obrázka.")
  }

  const safeFileName = sanitizeFileName(options.fileName)
  if (!safeFileName) {
    throw new Error("Neplatný názov súboru obrázka.")
  }

  const { bucket } = getS3Config()
  const client = getS3Client()
  const folder = sanitizeFolder(options.folder)
  const objectKey = path.posix.join(
    PRODUCTS_PREFIX,
    folder,
    safeProductId,
    safeFileName
  )

  const output = await sharp(buffer)
    .resize({ width: options.width, withoutEnlargement: true })
    .webp({ quality: options.quality })
    .toBuffer()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: output,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  )

  return buildProductsPublicUrl(objectKey)
}

function parseImageList(raw: string | null | undefined) {
  if (!raw) return []
  const parts = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const result: string[] = []
  for (const url of parts) {
    if (seen.has(url)) continue
    seen.add(url)
    result.push(url)
  }
  return result
}

function detectDelimiter(line: string) {
  const commaCount = (line.match(/,/g) || []).length
  const semiCount = (line.match(/;/g) || []).length
  if (semiCount > commaCount) return ";"
  return ","
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }

    if (ch === ",") {
      row.push(field)
      field = ""
      i += 1
      continue
    }

    if (ch === "\n" || ch === "\r") {
      row.push(field)
      field = ""
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row)
      }
      row = []
      if (ch === "\r" && text[i + 1] === "\n") {
        i += 2
        continue
      }
      i += 1
      continue
    }

    field += ch
    i += 1
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }

    if (ch === delimiter) {
      row.push(field)
      field = ""
      i += 1
      continue
    }

    if (ch === "\n" || ch === "\r") {
      row.push(field)
      field = ""
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row)
      }
      row = []
      if (ch === "\r" && text[i + 1] === "\n") {
        i += 2
        continue
      }
      i += 1
      continue
    }

    field += ch
    i += 1
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .trim()
    .toLowerCase()
}

function getHeaderIndex(headers: string[], name: string) {
  return headers.findIndex((header) => normalizeHeader(header) === normalizeHeader(name))
}

function normalizePriceType(value: string | null | undefined): PriceType | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase()
  if (["ON_REQUEST", "FIXED", "MATRIX", "AREA"].includes(normalized)) {
    return normalized as PriceType
  }
  return null
}

function normalizeCategorySlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
  return normalized || "category"
}

function categoryNameKey(parentId: string | null, name: string) {
  return `${parentId ?? "root"}::${name.trim().toLowerCase()}`
}

function parseCategoryPath(value: string) {
  return value
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean)
}

const POSTHandler = async (request: Request) => {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chýba CSV súbor." }, { status: 400 })
  }

  const matchKey = String(formData.get("matchKey") ?? "slug")
  const mode = String(formData.get("mode") ?? "upsert")
  const mappings = JSON.parse(String(formData.get("mapping") ?? "[]")) as MappingRow[]
  const defaultsRaw = String(formData.get("defaults") ?? "")
  const dryRun = String(formData.get("dryRun") ?? "false") === "true"
  const skipUnchanged = String(formData.get("skipUnchanged") ?? "false") === "true"
  const imageStrategy = String(formData.get("imageStrategy") ?? "original")
  const imageWidth = Math.max(200, parseNumberWithFallback(formData.get("imageWidth"), 1200))
  const imageQuality = Math.min(100, Math.max(40, parseNumberWithFallback(formData.get("imageQuality"), 80)))
  const imageFolder = sanitizeFolder(String(formData.get("imageFolder") ?? ""))

  const result: ImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  const rawText = await file.text()
  if (!rawText.trim()) {
    return NextResponse.json({ error: "CSV súbor je prázdny." }, { status: 400 })
  }

  const firstLine = rawText.split(/\n|\r/).find(Boolean) ?? ""
  const delimiter = detectDelimiter(firstLine)
  const rows = delimiter === "," ? parseCsv(rawText) : parseDelimited(rawText, delimiter)

  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV súbor nemá žiadne dáta." }, { status: 400 })
  }

  const header = rows[0].map(normalizeHeader)
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim().length > 0))
  const idColumnIndex = getHeaderIndex(header, "ID")

  if (dataRows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `CSV má príliš veľa riadkov (max ${MAX_ROWS}).` },
      { status: 400 }
    )
  }

  const defaults = parseDefaults(defaultsRaw)

  const categoryBySlug = new Map<string, CategoryRecord>()
  const categoryByParentAndName = new Map<string, CategoryRecord>()
  const registerCategory = (category: CategoryRecord) => {
    categoryBySlug.set(category.slug, category)
    categoryByParentAndName.set(
      categoryNameKey(category.parentId, category.name),
      category
    )
  }

  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, name: true, image: true, parentId: true },
  })
  categories.forEach((category) =>
    registerCategory({
      id: category.id,
      slug: category.slug,
      name: category.name,
      image: category.image,
      parentId: category.parentId,
    })
  )
  const defaultCategoryImage =
    categories.find((category) => !category.parentId)?.image ||
    DEFAULT_CATEGORY_IMAGE

  const resolveCategoryByPath = async (categoryPath: string) => {
    const pathParts = parseCategoryPath(categoryPath)
    if (pathParts.length === 0) {
      return null
    }

    let parent: CategoryRecord | null = null
    for (const part of pathParts) {
      const existingByName = categoryByParentAndName.get(
        categoryNameKey(parent?.id ?? null, part)
      )
      if (existingByName) {
        parent = existingByName
        continue
      }

      const baseSlug = normalizeCategorySlug(part)
      const preferredSlug = parent ? `${parent.slug}-${baseSlug}` : baseSlug
      let nextSlug = preferredSlug
      let counter = 2
      while (categoryBySlug.has(nextSlug)) {
        nextSlug = `${preferredSlug}-${counter}`
        counter += 1
      }

      const inheritedImage = parent?.image || defaultCategoryImage
      const created: CategoryRecord = dryRun
        ? {
            id: `dry:${nextSlug}:${parent?.id ?? "root"}`,
            slug: nextSlug,
            name: part,
            image: inheritedImage,
            parentId: parent?.id ?? null,
          }
        : await prisma.category.create({
            data: {
              slug: nextSlug,
              name: part,
              image: inheritedImage,
              parentId: parent?.id ?? null,
            },
            select: { id: true, slug: true, name: true, image: true, parentId: true },
          })

      registerCategory(created)
      parent = created
    }

    return parent
  }

  const mappingRows = mappings
    .map((row) => ({
      csvColumn: String(row.csvColumn ?? "").trim(),
      field: String(row.field ?? "").trim(),
    }))
    .filter((row) => row.csvColumn && row.field)

  for (const [index, row] of dataRows.entries()) {
    const rowNumber = index + 2
    try {
      const mappedData: Record<string, string> = {}
      mappingRows.forEach((mapRow) => {
        const columnIndex = getHeaderIndex(header, mapRow.csvColumn)
        if (columnIndex === -1) return
        mappedData[mapRow.field] = row[columnIndex]?.trim() ?? ""
      })

      const matchValue =
        mappedData[matchKey] ??
        defaults[matchKey] ??
        (matchKey === "wpProductId" && idColumnIndex !== -1
          ? row[idColumnIndex]?.trim()
          : undefined)
      if (!matchValue) {
        result.failed += 1
        result.errors.push(`Riadok ${rowNumber}: chýba hodnota pre ${matchKey}.`)
        continue
      }

      const data: Partial<Prisma.ProductUncheckedCreateInput> = {}

      if (mappedData.name || defaults.name) data.name = mappedData.name || defaults.name
      if (mappedData.slug || defaults.slug) data.slug = mappedData.slug || defaults.slug
      if (mappedData.excerpt || defaults.excerpt) {
        const rawExcerpt = mappedData.excerpt || defaults.excerpt || ""
        const sanitizedExcerpt = sanitizeHtml(rawExcerpt).trim()
        data.excerpt = sanitizedExcerpt.length > 0 ? sanitizedExcerpt : null
      }

      if (mappedData.description || defaults.description) {
        const rawDescription = mappedData.description || defaults.description || ""
        const sanitizedDescription = sanitizeHtml(rawDescription).trim()
        data.description = sanitizedDescription.length > 0 ? sanitizedDescription : null
      }

      const wpProductId = parseInteger(mappedData.wpProductId || defaults.wpProductId)
      if (wpProductId !== null) data.wpProductId = wpProductId

      const hasPriceFromInCsv = Object.prototype.hasOwnProperty.call(
        mappedData,
        "priceFrom"
      )
      const hasPriceFromDefault = Object.prototype.hasOwnProperty.call(
        defaults,
        "priceFrom"
      )
      const priceFromRaw =
        mappedData.priceFrom && mappedData.priceFrom.trim().length > 0
          ? mappedData.priceFrom
          : defaults.priceFrom
      if (hasPriceFromInCsv || hasPriceFromDefault) {
        const parsedPriceFrom = parseDecimalDetailed(priceFromRaw)
        if (parsedPriceFrom.kind === "invalid") {
          result.failed += 1
          result.errors.push(`Riadok ${rowNumber}: neplatná hodnota pre Cena od.`)
          continue
        }
        if (parsedPriceFrom.kind === "value") {
          data.priceFrom = parsedPriceFrom.value
        } else if (hasPriceFromInCsv && !hasPriceFromDefault) {
          // Keep DB in sync with CSV when mapped field is empty.
          data.priceFrom = null
        }
      }

      const hasDiscountPriceInCsv = Object.prototype.hasOwnProperty.call(
        mappedData,
        "priceAfterDiscountFrom"
      )
      const hasDiscountPriceDefault = Object.prototype.hasOwnProperty.call(
        defaults,
        "priceAfterDiscountFrom"
      )
      const discountPriceRaw =
        mappedData.priceAfterDiscountFrom &&
        mappedData.priceAfterDiscountFrom.trim().length > 0
          ? mappedData.priceAfterDiscountFrom
          : defaults.priceAfterDiscountFrom
      if (hasDiscountPriceInCsv || hasDiscountPriceDefault) {
        const parsedDiscountPrice = parseDecimalDetailed(discountPriceRaw)
        if (parsedDiscountPrice.kind === "invalid") {
          result.failed += 1
          result.errors.push(
            `Riadok ${rowNumber}: neplatná hodnota pre Cena po zľave od.`
          )
          continue
        }
        if (parsedDiscountPrice.kind === "value") {
          data.priceAfterDiscountFrom = parsedDiscountPrice.value
        } else if (hasDiscountPriceInCsv && !hasDiscountPriceDefault) {
          data.priceAfterDiscountFrom = null
        }
      }

      const vatRate = parseDecimal(mappedData.vatRate || defaults.vatRate)
      if (vatRate !== null) data.vatRate = vatRate

      const priceType = normalizePriceType(mappedData.priceType || defaults.priceType)
      if (priceType) data.priceType = priceType

      const isActive = parseBoolean(mappedData.isActive || defaults.isActive)
      if (isActive !== null) data.isActive = isActive

      const showInB2b = parseBoolean(mappedData.showInB2b || defaults.showInB2b)
      if (showInB2b !== null) data.showInB2b = showInB2b

      const showInB2c = parseBoolean(mappedData.showInB2c || defaults.showInB2c)
      if (showInB2c !== null) data.showInB2c = showInB2c

      const categoryPath = mappedData.categoryPath || defaults.categoryPath
      if (categoryPath) {
        const category = await resolveCategoryByPath(categoryPath)
        if (!category) {
          result.failed += 1
          result.errors.push(`Riadok ${rowNumber}: cesta kategórie je neplatná.`)
          continue
        }
        data.categoryId = category.id
      } else {
        const categorySlug = mappedData.categorySlug || defaults.categorySlug
        if (categorySlug) {
          const category = categoryBySlug.get(categorySlug)
          if (!category) {
            result.failed += 1
            result.errors.push(`Riadok ${rowNumber}: kategória ${categorySlug} neexistuje.`)
            continue
          }
          data.categoryId = category.id
        }
      }

      const imageRaw = mappedData.imageUrl || defaults.imageUrl
      const imageUrls = parseImageList(imageRaw)

      let existing = null as null | { id: string; slug: string | null; name: string; categoryId: string; wpProductId: number | null }
      if (matchKey === "slug") {
        existing = await prisma.product.findUnique({
          where: { slug: matchValue },
          select: { id: true, slug: true, name: true, categoryId: true, wpProductId: true },
        })
      } else if (matchKey === "wpProductId") {
        const numeric = parseInteger(matchValue)
        if (numeric !== null) {
          existing = await prisma.product.findFirst({
            where: { wpProductId: numeric },
            select: { id: true, slug: true, name: true, categoryId: true, wpProductId: true },
          })
        }
      }

      if (existing && mode === "create") {
        result.skipped += 1
        continue
      }

      if (!existing && mode === "update") {
        result.skipped += 1
        continue
      }

      if (!existing) {
        if (!data.name || !data.slug || !data.categoryId) {
          result.failed += 1
          result.errors.push(`Riadok ${rowNumber}: chýba povinné pole (name/slug/category).`)
          continue
        }

        if (!dryRun) {
          const created = await prisma.product.create({
            data: data as Prisma.ProductUncheckedCreateInput,
            select: { id: true },
          })

          if (imageUrls.length > 0) {
            for (let i = 0; i < imageUrls.length; i += 1) {
              const sourceUrl = imageUrls[i]
              const fileName = i === 0 ? "primary.webp" : `image-${i + 1}.webp`
              const finalImageUrl =
                imageStrategy === "download"
                  ? await downloadAndProcessImage({
                      imageUrl: sourceUrl,
                      productId: created.id,
                      folder: imageFolder,
                      width: imageWidth,
                      quality: imageQuality,
                      fileName,
                    })
                  : sourceUrl

              await prisma.productImage.create({
                data: {
                  productId: created.id,
                  url: finalImageUrl,
                  alt: String(data.name ?? "") || null,
                  isPrimary: i === 0,
                  sortOrder: i,
                },
              })
            }
          }
        }

        result.created += 1
        continue
      }

      if (skipUnchanged) {
        const keys = Object.keys(data) as Array<keyof typeof data>
        const changed = keys.some((key) => {
          const current = (existing as Record<string, unknown>)[key as string]
          const next = (data as Record<string, unknown>)[key as string]
          return current !== next
        })
        if (!changed && imageUrls.length === 0) {
          result.skipped += 1
          continue
        }
      }

      if (!dryRun) {
        await prisma.product.update({
          where: { id: existing.id },
          data: data as Prisma.ProductUncheckedUpdateInput,
        })

        if (imageUrls.length > 0) {
          // Delete all existing images and replace with new ones
          await prisma.productImage.deleteMany({
            where: { productId: existing.id },
          })

          for (let i = 0; i < imageUrls.length; i += 1) {
            const sourceUrl = imageUrls[i]
            const fileName = i === 0 ? "primary.webp" : `image-${i + 1}.webp`
            const finalImageUrl =
              imageStrategy === "download"
                ? await downloadAndProcessImage({
                    imageUrl: sourceUrl,
                    productId: existing.id,
                    folder: imageFolder,
                    width: imageWidth,
                    quality: imageQuality,
                    fileName,
                  })
                : sourceUrl

            await prisma.productImage.create({
              data: {
                productId: existing.id,
                url: finalImageUrl,
                alt: String(data.name ?? existing.name) || null,
                isPrimary: i === 0,
                sortOrder: i,
              },
            })
          }
        }
      }

      result.updated += 1
    } catch (error) {
      result.failed += 1
      result.errors.push(`Riadok ${rowNumber}: ${error instanceof Error ? error.message : "Neznáma chyba"}.`)
    }
  }

  if (!dryRun) {
    revalidatePath("/admin/products")
    revalidatePath("/catalog")
    revalidatePath("/product/[slug]", "page")
    invalidateAllCatalog()
  }

  return NextResponse.json(result)
}

export const POST = withObservedRoute("POST /api/admin/products/import", POSTHandler);



