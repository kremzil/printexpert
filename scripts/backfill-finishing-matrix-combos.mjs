import "dotenv/config"
import { PrismaClient } from "@prisma/client"

type PhpSerializable =
  | string
  | number
  | null
  | PhpSerializableArray
  | PhpSerializableRecord

type PhpSerializableArray = PhpSerializable[]
interface PhpSerializableRecord {
  [key: string]: PhpSerializable
}

const prisma = new PrismaClient()

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

const parseAterms = (aterms: string) => {
  const parts = aterms.split("-")
  const map = new Map<string, string>()
  parts.forEach((part) => {
    const [aid, termId] = part.split(":")
    if (!aid || !termId) return
    map.set(aid, termId)
  })
  return map
}

const buildAterms = (
  attributeOrder: string[],
  termsByAttribute: Map<string, string>
) =>
  attributeOrder
    .map((aid) => {
      const term = termsByAttribute.get(aid)
      return term ? `${aid}:${term}` : null
    })
    .filter((value): value is string => Boolean(value))
    .join("-")

const buildCombos = (
  attributes: string[],
  termsByAttribute: Map<string, string[]>
) => {
  const combos: Map<string, string> = new Map()

  const walk = (index: number, current: Map<string, string>) => {
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

  const baseByProduct = new Map<number, typeof baseMatrices[number]>()
  baseMatrices.forEach((row) => {
    if (!baseByProduct.has(row.productId)) {
      baseByProduct.set(row.productId, row)
    }
  })

  let createdTotal = 0
  let touchedMatrices = 0

  for (const matrix of finishingMatrices) {
    const base = baseByProduct.get(matrix.productId)
    if (!base || !matrix.attributes || !matrix.aterms) {
      continue
    }

    const baseAttributeIds = toStringArray(phpUnserialize(base.attributes || ""))
    const baseAtermsMap = phpUnserialize(base.aterms || "")
    if (!baseAttributeIds.length || !baseAtermsMap || typeof baseAtermsMap !== "object" || Array.isArray(baseAtermsMap)) {
      continue
    }

    const baseTermsByAttribute = new Map<string, string[]>()
    baseAttributeIds.forEach((aid) => {
      const terms = toStringArray((baseAtermsMap as Record<string, PhpSerializable>)[aid])
      if (terms.length > 0) {
        baseTermsByAttribute.set(aid, terms)
      }
    })

    const finishingAttributeIds = toStringArray(phpUnserialize(matrix.attributes))
    const finishingAtermsMap = phpUnserialize(matrix.aterms)
    if (!finishingAttributeIds.length || !finishingAtermsMap || typeof finishingAtermsMap !== "object" || Array.isArray(finishingAtermsMap)) {
      continue
    }

    const finishingTermsByAttribute = new Map<string, string[]>()
    finishingAttributeIds.forEach((aid) => {
      const terms = toStringArray((finishingAtermsMap as Record<string, PhpSerializable>)[aid])
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
      continue
    }

    const existingKeys = new Set(
      existingPrices.map((row) => `${row.aterms}|${row.number.toString()}`)
    )

    const rowsToCreate: { mtypeId: number; aterms: string; number: bigint; price: string }[] = []

    for (const row of existingPrices) {
      const rowTerms = parseAterms(String(row.aterms))
      const hasAllBase = baseAttributeIds.every((aid) => rowTerms.has(aid))
      if (hasAllBase) {
        continue
      }

      for (const baseCombo of baseCombos) {
        const baseTerms = parseAterms(baseCombo)
        const merged = new Map<string, string>()
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
      await prisma.wpMatrixPrice.createMany({
        data: rowsToCreate,
        skipDuplicates: true,
      })
      createdTotal += rowsToCreate.length
      touchedMatrices += 1
      console.log(
        `Matrix ${matrix.mtypeId}: created ${rowsToCreate.length} rows.`
      )
    }
  }

  console.log(
    `Done. Matrices updated: ${touchedMatrices}. Rows created: ${createdTotal}.`
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
