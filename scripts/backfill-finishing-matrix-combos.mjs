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

const isDryRun = process.argv.includes("--dry-run")
const doCleanup = process.argv.includes("--cleanup")
const zeroOnly = process.argv.includes("--zero-only")

const main = async () => {
  const finishingMatrices = await prisma.wpMatrixType.findMany({
    where: { mtype: 1 },
    select: {
      mtypeId: true,
      productId: true,
      attributes: true,
      aterms: true,
      numbers: true,
    },
    orderBy: [{ productId: "asc" }, { sorder: "asc" }],
  })

  if (finishingMatrices.length === 0) {
    console.log("No finishing matrices found.")
    return
  }

  const baseMatrices = await prisma.wpMatrixType.findMany({
    where: { mtype: 0, productId: { in: finishingMatrices.map((m) => m.productId) } },
    select: { productId: true, attributes: true, aterms: true },
    orderBy: [{ productId: "asc" }, { sorder: "asc" }],
  })

  const baseByProduct = new Map()
  baseMatrices.forEach((row) => {
    if (!baseByProduct.has(row.productId)) {
      baseByProduct.set(row.productId, row)
    }
  })

  let createdTotal = 0
  let zeroPriceTotal = 0
  let cleanedTotal = 0
  let touchedMatrices = 0

  for (const matrix of finishingMatrices) {
    const base = baseByProduct.get(matrix.productId)
    if (!base || !matrix.attributes || !matrix.aterms) {
      continue
    }

    let baseAttributeIds = []
    let baseAtermsMap = null
    try {
      baseAttributeIds = toStringArray(phpUnserialize(base.attributes || ""))
      baseAtermsMap = phpUnserialize(base.aterms || "")
    } catch (error) {
      console.warn(
        `Skip matrix ${matrix.mtypeId}: failed to parse base matrix data for product ${matrix.productId}.`,
        error
      )
      continue
    }
    if (
      !baseAttributeIds.length ||
      !baseAtermsMap ||
      typeof baseAtermsMap !== "object" ||
      Array.isArray(baseAtermsMap)
    ) {
      continue
    }

    const baseTermsByAttribute = new Map()
    baseAttributeIds.forEach((aid) => {
      const terms = toStringArray(baseAtermsMap[aid])
      if (terms.length > 0) {
        baseTermsByAttribute.set(aid, terms)
      }
    })

    let finishingAttributeIds = []
    let finishingAtermsMap = null
    try {
      finishingAttributeIds = toStringArray(phpUnserialize(matrix.attributes))
      finishingAtermsMap = phpUnserialize(matrix.aterms)
    } catch (error) {
      console.warn(
        `Skip matrix ${matrix.mtypeId}: failed to parse finishing matrix data.`,
        error
      )
      continue
    }
    if (
      !finishingAttributeIds.length ||
      !finishingAtermsMap ||
      typeof finishingAtermsMap !== "object" ||
      Array.isArray(finishingAtermsMap)
    ) {
      continue
    }

    const finishingTermsByAttribute = new Map()
    finishingAttributeIds.forEach((aid) => {
      const terms = toStringArray(finishingAtermsMap[aid])
      if (terms.length > 0) {
        finishingTermsByAttribute.set(aid, terms)
      }
    })

    const combinedAttributes = [
      ...baseAttributeIds,
      ...finishingAttributeIds.filter((aid) => !baseAttributeIds.includes(aid)),
    ].filter((aid) =>
      (baseTermsByAttribute.get(aid)?.length ?? 0) > 0 ||
      (finishingTermsByAttribute.get(aid)?.length ?? 0) > 0
    )

    if (combinedAttributes.length === 0) {
      continue
    }

    const baseCombos = buildCombos(baseAttributeIds, baseTermsByAttribute)
    if (baseCombos.length === 0) {
      continue
    }

    const existingPrices = await prisma.wpMatrixPrice.findMany({
      where: { mtypeId: matrix.mtypeId },
      select: { aterms: true, number: true, price: true },
    })

    if (existingPrices.length === 0) {
      const breakpoints = (matrix.numbers ?? "")
        .split(/[|,;\s]+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => Number(value))
        .filter((value) => !Number.isNaN(value))

      if (breakpoints.length === 0) {
        console.warn(
          `Matrix ${matrix.mtypeId}: skipped zero-price generation (no breakpoints).`
        )
        continue
      }

      const combinedTermsByAttribute = new Map()
      combinedAttributes.forEach((aid) => {
        const terms = [
          ...(baseTermsByAttribute.get(aid) ?? []),
          ...(finishingTermsByAttribute.get(aid) ?? []),
        ]
        if (terms.length > 0) {
          combinedTermsByAttribute.set(aid, Array.from(new Set(terms)))
        }
      })

      const combos = buildCombos(combinedAttributes, combinedTermsByAttribute)
      if (combos.length === 0) {
        console.warn(
          `Matrix ${matrix.mtypeId}: skipped zero-price generation (no combinations).`
        )
        continue
      }

      const rowsToCreate = combos.flatMap((aterms) =>
        breakpoints.map((number) => ({
          mtypeId: matrix.mtypeId,
          aterms,
          number: BigInt(number),
          price: "0",
        }))
      )

      if (!isDryRun) {
        await prisma.wpMatrixPrice.createMany({
          data: rowsToCreate,
          skipDuplicates: true,
        })
      }

      zeroPriceTotal += rowsToCreate.length
      touchedMatrices += 1
      console.log(
        `Matrix ${matrix.mtypeId}: ${isDryRun ? "would create" : "created"} ${
          rowsToCreate.length
        } zero-price rows.`
      )
      continue
    }

    if (zeroOnly) {
      continue
    }

    const existingKeys = new Set(
      existingPrices.map((row) => `${row.aterms}|${row.number.toString()}`)
    )

    const rowsToCreate = []
    const rowsToDelete = []

    for (const row of existingPrices) {
      const rowTerms = parseAterms(String(row.aterms))
      const hasAllBase = baseAttributeIds.every((aid) => rowTerms.has(aid))
      if (!hasAllBase) {
        if (doCleanup) {
          rowsToDelete.push({ aterms: String(row.aterms), number: row.number })
        }
      } else {
        continue
      }

      for (const baseCombo of baseCombos) {
        const baseTerms = parseAterms(baseCombo)
        const merged = new Map()
        combinedAttributes.forEach((aid) => {
          const term = rowTerms.get(aid) ?? baseTerms.get(aid)
          if (term) {
            merged.set(aid, term)
          }
        })

        const aterms = buildAterms(combinedAttributes, merged)
        if (!aterms) {
          continue
        }

        const key = `${aterms}|${row.number.toString()}`
        if (existingKeys.has(key)) {
          continue
        }

        existingKeys.add(key)
        rowsToCreate.push({
          mtypeId: matrix.mtypeId,
          aterms,
          number: BigInt(row.number.toString()),
          price: String(row.price),
        })
      }
    }

    if (rowsToCreate.length > 0) {
      if (!isDryRun) {
        await prisma.wpMatrixPrice.createMany({
          data: rowsToCreate,
          skipDuplicates: true,
        })
      }
      createdTotal += rowsToCreate.length
      touchedMatrices += 1
      console.log(
        `Matrix ${matrix.mtypeId}: ${isDryRun ? "would create" : "created"} ${
          rowsToCreate.length
        } rows.`
      )
    }

    if (rowsToDelete.length > 0) {
      if (doCleanup && !isDryRun) {
        const chunkSize = 1000
        for (let i = 0; i < rowsToDelete.length; i += chunkSize) {
          const chunk = rowsToDelete.slice(i, i + chunkSize)
          await prisma.wpMatrixPrice.deleteMany({
            where: {
              mtypeId: matrix.mtypeId,
              OR: chunk.map((row) => ({
                aterms: row.aterms,
                number: row.number,
              })),
            },
          })
        }
      }
      cleanedTotal += rowsToDelete.length
      touchedMatrices += 1
      console.log(
        `Matrix ${matrix.mtypeId}: ${isDryRun ? "would delete" : "deleted"} ${
          rowsToDelete.length
        } incomplete rows.`
      )
    }
  }

  console.log(
    `Done. Matrices ${isDryRun ? "to update" : "updated"}: ${touchedMatrices}. Rows ${
      isDryRun ? "to create" : "created"
    }: ${createdTotal}. Zero-price rows ${
      isDryRun ? "to create" : "created"
    }: ${zeroPriceTotal}. Rows ${
      isDryRun ? "to delete" : "deleted"
    }: ${cleanedTotal}.`
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
