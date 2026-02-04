import "dotenv/config"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { PrismaClient } = require("../lib/generated/prisma")
const { PrismaPg } = require("@prisma/adapter-pg")
const { Pool } = require("pg")

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  ),
})

const isDryRun = process.argv.includes("--dry-run")
const categorySlugArg = process.argv.find((arg) => arg.startsWith("--slug="))
const categoryNameArg = process.argv.find((arg) => arg.startsWith("--name="))
const skipWpArg = process.argv.find((arg) => arg.startsWith("--skip-wp="))

const categorySlug = categorySlugArg ? categorySlugArg.split("=")[1] : null
const categoryName = categoryNameArg ? categoryNameArg.split("=")[1] : "Pečiatky"
const skipWpIds = skipWpArg
  ? skipWpArg
      .split("=")[1]
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  : [1858]

const getByteLength = (value) => Buffer.byteLength(value, "utf8")

const phpSerialize = (value) => {
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

const phpUnserialize = (input) => {
  let idx = 0

  const readUntil = (char) => {
    const start = idx
    const end = input.indexOf(char, idx)
    if (end === -1) {
      throw new Error("Invalid serialization")
    }
    idx = end + 1
    return input.slice(start, end)
  }

  const parseValue = () => {
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
      const obj = {}
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

const toStringArray = (value) => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item))
  }
  if (typeof value === "object") {
    return Object.values(value).map((item) => String(item))
  }
  return []
}

const parseAterms = (aterms) => {
  const parts = aterms.split("-")
  const map = new Map()
  parts.forEach((part) => {
    const [aid, termId] = part.split(":")
    if (!aid || !termId) return
    map.set(aid, termId)
  })
  return map
}

const buildAterms = (attributeOrder, termsByAttribute) =>
  attributeOrder
    .map((aid) => {
      const term = termsByAttribute.get(aid)
      return term ? `${aid}:${term}` : null
    })
    .filter((value) => Boolean(value))
    .join("-")

const buildCombos = (attributes, termsByAttribute) => {
  const combos = new Map()

  const walk = (index, current) => {
    if (index >= attributes.length) {
      combos.set(buildAterms(attributes, current), buildAterms(attributes, current))
      return
    }
    const aid = attributes[index]
    const terms = termsByAttribute.get(aid) ?? []
    if (terms.length === 0) {
      walk(index + 1, current)
      return
    }
    terms.forEach((termId) => {
      const next = new Map(current)
      next.set(aid, termId)
      walk(index + 1, next)
    })
  }

  walk(0, new Map())
  return Array.from(combos.keys()).filter(Boolean)
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

const main = async () => {
  const category = await prisma.category.findFirst({
    where: categorySlug ? { slug: categorySlug } : { name: categoryName },
    select: { id: true, name: true, slug: true },
  })

  if (!category) {
    console.error("Category not found.")
    return
  }

  const allCategories = await prisma.category.findMany({
    select: { id: true, parentId: true },
  })
  const childrenByParent = new Map()
  allCategories.forEach((row) => {
    const list = childrenByParent.get(row.parentId) ?? []
    list.push(row.id)
    childrenByParent.set(row.parentId, list)
  })

  const categoryIds = new Set([category.id])
  const queue = [category.id]
  while (queue.length > 0) {
    const current = queue.shift()
    const children = childrenByParent.get(current) ?? []
    children.forEach((childId) => {
      if (!categoryIds.has(childId)) {
        categoryIds.add(childId)
        queue.push(childId)
      }
    })
  }

  const products = await prisma.product.findMany({
    where: { categoryId: { in: Array.from(categoryIds) }, wpProductId: { not: null } },
    select: { id: true, name: true, slug: true, wpProductId: true },
  })

  if (products.length === 0) {
    console.log("No products with wpProductId found in category.")
    return
  }

  let updatedProducts = 0
  let createdRows = 0
  let deletedFinishing = 0

  for (const product of products) {
    const wpId = product.wpProductId
    if (!wpId || skipWpIds.includes(wpId)) {
      continue
    }

    const matrices = await prisma.wpMatrixType.findMany({
      where: { productId: wpId },
      orderBy: [{ mtype: "asc" }, { sorder: "asc" }],
      select: {
        mtypeId: true,
        mtype: true,
        sorder: true,
        attributes: true,
        aterms: true,
        numbers: true,
      },
    })

    const baseMatrices = matrices.filter((row) => row.mtype === 0)
    const finishingMatrices = matrices.filter((row) => row.mtype === 1)

    if (baseMatrices.length === 0 || finishingMatrices.length === 0) {
      continue
    }

    const baseMatrix = baseMatrices[0]

    const baseAttributeIds = toStringArray(phpUnserialize(baseMatrix.attributes || ""))
    const baseAtermsMap = phpUnserialize(baseMatrix.aterms || "")
    if (
      !baseAttributeIds.length ||
      !baseAtermsMap ||
      typeof baseAtermsMap !== "object" ||
      Array.isArray(baseAtermsMap)
    ) {
      console.warn(`Skip wpProductId ${wpId}: base matrix data invalid.`)
      continue
    }

    const baseTermsByAttribute = new Map()
    baseAttributeIds.forEach((aid) => {
      const terms = toStringArray(baseAtermsMap[aid])
      if (terms.length > 0) {
        baseTermsByAttribute.set(aid, terms)
      }
    })

    const finishingAttributeOrder = []
    const finishingTermsByAttribute = new Map()
    let finishingHasNonZero = false

    for (const finishingMatrix of finishingMatrices) {
      const finishingAttributeIds = toStringArray(
        phpUnserialize(finishingMatrix.attributes || "")
      )
      const finishingAtermsMap = phpUnserialize(finishingMatrix.aterms || "")
      if (
        !finishingAttributeIds.length ||
        !finishingAtermsMap ||
        typeof finishingAtermsMap !== "object" ||
        Array.isArray(finishingAtermsMap)
      ) {
        console.warn(
          `Skip wpProductId ${wpId}: finishing matrix ${finishingMatrix.mtypeId} data invalid.`
        )
        finishingHasNonZero = true
        break
      }

      finishingAttributeIds.forEach((aid) => {
        if (!finishingAttributeOrder.includes(aid)) {
          finishingAttributeOrder.push(aid)
        }
        const terms = toStringArray(finishingAtermsMap[aid])
        if (terms.length > 0) {
          const existing = new Set(finishingTermsByAttribute.get(aid) ?? [])
          terms.forEach((term) => existing.add(term))
          finishingTermsByAttribute.set(aid, Array.from(existing))
        }
      })

      const finishingPrices = await prisma.wpMatrixPrice.findMany({
        where: { mtypeId: finishingMatrix.mtypeId },
        select: { price: true },
      })
      if (finishingPrices.some((row) => Number(row.price) !== 0)) {
        finishingHasNonZero = true
      }
    }

    if (finishingHasNonZero) {
      console.warn(`Skip wpProductId ${wpId}: finishing prices are not zero.`)
      continue
    }

    const combinedAttributes = [
      ...baseAttributeIds,
      ...finishingAttributeOrder.filter((aid) => !baseAttributeIds.includes(aid)),
    ].filter((aid) =>
      (baseTermsByAttribute.get(aid)?.length ?? 0) > 0 ||
      (finishingTermsByAttribute.get(aid)?.length ?? 0) > 0
    )

    if (combinedAttributes.length === baseAttributeIds.length) {
      console.warn(`Skip wpProductId ${wpId}: no finishing attributes to merge.`)
      continue
    }

    const basePrices = await prisma.wpMatrixPrice.findMany({
      where: { mtypeId: baseMatrix.mtypeId },
      select: { aterms: true, number: true, price: true },
    })

    if (basePrices.length === 0) {
      console.warn(`Skip wpProductId ${wpId}: base matrix has no prices.`)
      continue
    }

    const finishingCombos = buildCombos(
      finishingAttributeOrder,
      finishingTermsByAttribute
    )
    if (finishingCombos.length === 0) {
      console.warn(`Skip wpProductId ${wpId}: no finishing combinations.`)
      continue
    }

    const existingBaseKeys = new Set(
      basePrices.map((row) => `${row.aterms}|${row.number.toString()}`)
    )
    const rowsToCreate = []

    for (const row of basePrices) {
      const baseTerms = parseAterms(String(row.aterms))
      for (const finishingCombo of finishingCombos) {
        const finishingTerms = parseAterms(finishingCombo)
        const merged = new Map()
        combinedAttributes.forEach((aid) => {
          const term = baseTerms.get(aid) ?? finishingTerms.get(aid)
          if (term) {
            merged.set(aid, term)
          }
        })
        const aterms = buildAterms(combinedAttributes, merged)
        if (!aterms) {
          continue
        }
        const key = `${aterms}|${row.number.toString()}`
        if (existingBaseKeys.has(key)) {
          continue
        }
        existingBaseKeys.add(key)
        rowsToCreate.push({
          mtypeId: baseMatrix.mtypeId,
          aterms,
          number: BigInt(row.number.toString()),
          price: String(row.price),
        })
      }
    }

    const combinedAterms = combinedAttributes.reduce((acc, aid) => {
      const terms = new Set([
        ...(baseTermsByAttribute.get(aid) ?? []),
        ...(finishingTermsByAttribute.get(aid) ?? []),
      ])
      acc[aid] = Array.from(terms)
      return acc
    }, {})

    if (!isDryRun) {
      if (rowsToCreate.length > 0) {
        for (const part of chunk(rowsToCreate, 1000)) {
          await prisma.wpMatrixPrice.createMany({
            data: part,
            skipDuplicates: true,
          })
        }
      }

      await prisma.wpMatrixType.update({
        where: { mtypeId: baseMatrix.mtypeId },
        data: {
          attributes: phpSerialize(combinedAttributes),
          aterms: phpSerialize(combinedAterms),
        },
      })

      const finishingIds = finishingMatrices.map((row) => row.mtypeId)
      if (finishingIds.length > 0) {
        await prisma.wpMatrixPrice.deleteMany({
          where: { mtypeId: { in: finishingIds } },
        })
        await prisma.wpMatrixType.deleteMany({
          where: { mtypeId: { in: finishingIds } },
        })
        deletedFinishing += finishingIds.length
      }
    }

    if (rowsToCreate.length > 0 || !isDryRun) {
      updatedProducts += 1
      createdRows += rowsToCreate.length
      console.log(
        `wpProductId ${wpId}: ${isDryRun ? "would create" : "created"} ${
          rowsToCreate.length
        } rows, ${isDryRun ? "would remove" : "removed"} ${
          finishingMatrices.length
        } finishing matrices.`
      )
    }
  }

  console.log(
    `Done. Products ${isDryRun ? "to update" : "updated"}: ${updatedProducts}. Rows ${
      isDryRun ? "to create" : "created"
    }: ${createdRows}. Finishing matrices ${
      isDryRun ? "to remove" : "removed"
    }: ${deletedFinishing}.`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
