import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { getPrisma } from "@/lib/prisma"

type MatrixSelectOption = {
  value: string
  label: string
  selected?: boolean
}

type MatrixSelect = {
  aid: string
  label: string
  name: string
  class: string
  options: MatrixSelectOption[]
}

type MatrixPriceEntry = {
  aterms: string
  terms: Record<string, string>
  breakpoint: number
  price: string
}

type Matrix = {
  kind: "simple" | "finishing"
  mtid: string
  isActive: boolean
  title: string | null
  ntp: string
  numStyle: string | null
  aUnit: string | null
  material: string | null
  selects: MatrixSelect[]
  prices: MatrixPriceEntry[]
}

type PricingGlobals = {
  dim_unit: string | null
  a_unit: number | string | null
  min_quantity: number | string | null
  min_width: number | string | null
  min_height: number | string | null
  max_width: number | string | null
  max_height: number | string | null
  numbers_array: Record<string, string>
  smatrix: Record<string, number>
  fmatrix: Record<string, number>
}

export type WpCalculatorData = {
  product_id: string
  globals: PricingGlobals
  matrices: Matrix[]
}

type PhpSerializedValue = string | number | null | PhpSerializedValue[] | Record<string, PhpSerializedValue>

const sizeKeywords = [
  "velkost",
  "rozmer",
  "rozmery",
  "format",
  "sirka",
  "vyska",
  "size",
  "width",
  "height",
]
const colourKeywords = ["farba", "farby", "color", "colour"]
const materialKeywords = ["material", "materi", "folia", "folie"]

const normalizeName = (value: string) => value.toLowerCase()
const hasKeyword = (value: string, keywords: string[]) =>
  keywords.some((keyword) => normalizeName(value).includes(keyword))

function unserialize(input: string): PhpSerializedValue {
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

  const parseValue = (): PhpSerializedValue => {
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
      const obj: Record<string, PhpSerializedValue> = {}
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

function toArray(value: PhpSerializedValue): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item))
  }
  if (typeof value === "object") {
    return Object.values(value).map((item) => String(item))
  }
  return []
}

function buildClass(kind: Matrix["kind"], mtid: string, aid: string, attrName: string) {
  if (kind === "finishing") {
    return `fmatrix-attr fmatrix-attr-${mtid}${aid}`
  }

  let extra = ""
  if (hasKeyword(attrName, sizeKeywords)) {
    extra = " smatrix-size"
  } else if (hasKeyword(attrName, colourKeywords)) {
    extra = " smatrix-colour"
  } else if (hasKeyword(attrName, materialKeywords)) {
    extra = " smatrix-material"
  }

  return `smatrix-attr smatrix-attr-${mtid}${aid}${extra}`.trim()
}

export async function getWpCalculatorData(
  wpProductId: number,
  includeInactive = false
): Promise<WpCalculatorData | null> {
  "use cache"
  cacheTag("wp-matrix")
  cacheLife("hours")
  const prisma = getPrisma()

  const matrixTypes = await prisma.wpMatrixType.findMany({
    where: includeInactive
      ? { productId: wpProductId }
      : { productId: wpProductId, isActive: true },
    orderBy: [{ mtype: "asc" }, { sorder: "asc" }],
  })

  if (matrixTypes.length === 0) {
    return null
  }

  const mtypeIds = matrixTypes.map((row) => row.mtypeId)
  const matrixPrices = await prisma.wpMatrixPrice.findMany({
    where: { mtypeId: { in: mtypeIds } },
  })

  const attributeIds = new Set<string>()
  const termIds = new Set<string>()

  for (const row of matrixTypes) {
    const attrs = row.attributes ? toArray(unserialize(row.attributes)) : []
    attrs.forEach((id) => attributeIds.add(id))

    const aterms = row.aterms ? unserialize(row.aterms) : null
    const atermsObj =
      aterms && typeof aterms === "object" && !Array.isArray(aterms) ? aterms : {}
    Object.values(atermsObj).forEach((termList) => {
      toArray(termList as PhpSerializedValue).forEach((id) => termIds.add(id))
    })
  }

  const [attributes, terms, termMeta] = await Promise.all([
    prisma.wpAttributeTaxonomy.findMany({
      where: { attributeId: { in: Array.from(attributeIds).map(Number) } },
    }),
    prisma.wpTerm.findMany({
      where: { termId: { in: Array.from(termIds).map(Number) } },
    }),
    prisma.wpTermMeta.findMany({
      where: {
        termId: { in: Array.from(termIds).map(Number) },
        metaKey: { startsWith: "order" },
      },
    }),
  ])

  const attributeById = new Map(
    attributes.map((row) => [String(row.attributeId), row])
  )
  const termById = new Map(terms.map((row) => [String(row.termId), row]))
  const termOrderByKey = new Map<string, number>()
  const parseOrder = (value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  termMeta.forEach((row) => {
    const order = parseOrder(row.metaValue)
    if (order === null) return
    termOrderByKey.set(`${row.termId}:${row.metaKey}`, order)
  })
  const getTermOrder = (termId: string, attributeName?: string | null) => {
    if (attributeName) {
      const key = `${termId}:order_pa_${attributeName}`
      const value = termOrderByKey.get(key)
      if (value !== undefined) {
        return value
      }
    }
    return termOrderByKey.get(`${termId}:order`) ?? null
  }

  const numbersArray: Record<string, string> = {}
  const smatrix: Record<string, number> = {}
  const fmatrix: Record<string, number> = {}

  for (const row of matrixTypes) {
    if (row.numbers) {
      numbersArray[String(row.mtypeId)] = row.numbers
    }
  }

  const kindByMtypeId = new Map(
    matrixTypes.map((row) => [
      row.mtypeId,
      row.mtype === 1 ? "finishing" : "simple",
    ])
  )

  const pricesByMtypeId = new Map<number, MatrixPriceEntry[]>()
  const getTermLabel = (aid: string, termId: string) => {
    const attribute = attributeById.get(String(aid))
    const term = termById.get(String(termId))
    const attrLabel = attribute?.attributeLabel ?? attribute?.attributeName
    const termLabel = term?.name ?? termId
    return { attrLabel: attrLabel ?? `Atribút ${aid}`, termLabel }
  }

  const parseAterms = (atermsValue: string) => {
    const parts = atermsValue.split("-")
    const map: Record<string, string> = {}
    for (const part of parts) {
      const [aid, termId] = part.split(":")
      if (!aid || !termId) continue
      const { termLabel } = getTermLabel(aid, termId)
      map[aid] = termLabel
    }
    return map
  }

  for (const row of matrixPrices) {
    const keyBase = String(row.aterms)
    const breakpoint = row.number.toString()
    const price = Number(String(row.price))
    const key = `${keyBase}-${breakpoint}`
    const kind = kindByMtypeId.get(row.mtypeId) ?? "simple"
    if (kind === "finishing") {
      fmatrix[key] = price
    } else {
      smatrix[key] = price
    }

    const list = pricesByMtypeId.get(row.mtypeId) ?? []
    list.push({
      aterms: String(row.aterms),
      terms: parseAterms(String(row.aterms)),
      breakpoint: Number(row.number),
      price: row.price.toString(),
    })
    pricesByMtypeId.set(row.mtypeId, list)
  }

  const matrices: Matrix[] = matrixTypes.map((row) => {
    const kind: Matrix["kind"] = row.mtype === 1 ? "finishing" : "simple"
    const attrs = row.attributes ? toArray(unserialize(row.attributes)) : []
    const aterms = row.aterms ? unserialize(row.aterms) : null
    const atermsObj =
      aterms && typeof aterms === "object" && !Array.isArray(aterms) ? aterms : {}

    const selects = attrs.map((aid) => {
      const attr = attributeById.get(String(aid))
      const attrLabel = attr?.attributeLabel ?? attr?.attributeName ?? ""
      const attrName = attr
        ? `${attr.attributeName} ${attr.attributeLabel}`
        : ""

      const termIdsList = toArray(atermsObj[String(aid)] ?? [])
      const options = termIdsList
        .map((termId) => {
          const term = termById.get(String(termId))
          return {
            value: String(termId),
            label: term?.name ?? String(termId),
            order: getTermOrder(String(termId), attr?.attributeName ?? null),
          }
        })
        .sort((a, b) => {
          const orderA = a.order ?? Number.MAX_SAFE_INTEGER
          const orderB = b.order ?? Number.MAX_SAFE_INTEGER
          if (orderA !== orderB) return orderA - orderB
          return a.label.localeCompare(b.label)
        })
        .map((option, index) => ({
          value: option.value,
          label: option.label,
          selected: index === 0 ? true : undefined,
        }))

      return {
        aid: String(aid),
        label: attrLabel || `Atribút ${aid}`,
        name: `${kind === "simple" ? "sattribute" : "fattribute"}[${aid}]`,
        class: buildClass(kind, String(row.mtypeId), String(aid), attrName),
        options,
      }
    })

    return {
      kind,
      mtid: String(row.mtypeId),
      isActive: row.isActive ?? true,
      title: row.title ?? null,
      ntp: String(row.numType ?? 0),
      numStyle:
        row.numStyle !== null && row.numStyle !== undefined
          ? String(row.numStyle)
          : null,
      aUnit: row.aUnit ?? null,
      material: null,
      selects,
      prices: (pricesByMtypeId.get(row.mtypeId) ?? []).sort((a, b) =>
        a.breakpoint === b.breakpoint
          ? a.aterms.localeCompare(b.aterms)
          : a.breakpoint - b.breakpoint
      ),
    }
  })

  return {
    product_id: String(wpProductId),
    globals: {
      dim_unit: null,
      a_unit: null,
      min_quantity: null,
      min_width: null,
      min_height: null,
      max_width: null,
      max_height: null,
      numbers_array: numbersArray,
      smatrix,
      fmatrix,
    },
    matrices,
  }
}
