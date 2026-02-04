import "server-only"

import { getPrisma } from "@/lib/prisma"
import type { AudienceContext } from "@/lib/audience-shared"
import { getWpCalculatorData } from "@/lib/wp-calculator"
import { getShopSettings } from "@/lib/shop-settings"

type MatrixSelect = {
  aid: string
  options: Array<{ value: string; selected?: boolean }>
  class: string
}

type Matrix = {
  kind: "simple" | "finishing"
  mtid: string
  ntp: string
  numStyle: string | null
  aUnit: string | null
  material?: string | null
  selects: MatrixSelect[]
  isActive?: boolean
}

type PricingGlobals = {
  dim_unit: string | null
  a_unit: number | string | null
  min_quantity: number | string | null
  min_width: number | string | null
  min_height: number | string | null
  numbers_array: Array<string | null> | Record<string, string | null>
  smatrix: Record<string, number>
  fmatrix: Record<string, number>
}

type CalculatorData = {
  globals: PricingGlobals
  matrices: Matrix[]
}

export type PriceCalculationParams = {
  quantity?: number
  width?: number | null
  height?: number | null
  selections?: Record<string, Record<string, string>>
  productionSpeedPercent?: number
  userDiscountPercent?: number
}

export type PriceResult = {
  net: number
  vatAmount: number
  gross: number
  currency: "EUR"
  breakdown?: Record<string, unknown>
}

const FALLBACK_DIM_UNIT = "cm"
const FALLBACK_A_UNIT = 1

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

const buildClass = (
  kind: Matrix["kind"],
  mtid: string,
  aid: string,
  attrName: string
) => {
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

const roundCurrency = (value: number) => Math.round(value * 100) / 100

const parseNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const resolveAreaUnit = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return null
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "m2" || normalized === "m²") {
      return "m2"
    }
    if (normalized === "cm2" || normalized === "cm²") {
      return "cm2"
    }
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === "number") {
    return value
  }
  return null
}

const parseBreakpoints = (value: string | null | undefined) => {
  if (!value) return []
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))
}

const getNumbersEntry = (
  numbersArray: Array<string | null> | Record<string, string | null>,
  mtid: string
) => {
  if (Array.isArray(numbersArray)) {
    return numbersArray[Number(mtid)] ?? null
  }
  return numbersArray[mtid] ?? null
}

const normalizeDimensions = (
  width: number,
  height: number,
  dimUnit: string,
  aUnit: string | number
) => {
  const isMeters =
    typeof aUnit === "string" ? aUnit.toLowerCase() === "m2" : aUnit !== 1

  if (dimUnit === "cm") {
    if (isMeters) {
      return { width: width / 100, height: height / 100 }
    }
    return { width, height }
  }

  if (dimUnit === "mm") {
    const widthCm = width / 10
    const heightCm = height / 10
    if (isMeters) {
      return { width: widthCm / 100, height: heightCm / 100 }
    }
    return { width: widthCm, height: heightCm }
  }

  return { width, height }
}

const calculateQuantity = (
  quantity: number,
  width: number | null,
  height: number | null,
  ntp: number,
  dimUnit: string,
  aUnit: string | number
) => {
  if (ntp === 2 || ntp === 3 || ntp === 4) {
    if (width === null || height === null) {
      return null
    }

    const normalized = normalizeDimensions(width, height, dimUnit, aUnit)
    if (ntp === 2) {
      return quantity * normalized.width * normalized.height
    }
    if (ntp === 3) {
      return quantity * (2 * normalized.width + 2 * normalized.height)
    }
    if (ntp === 4) {
      return quantity * (2 * normalized.width)
    }
  }

  return quantity
}

const ceilDecimal = (value: number, exp: number) => {
  const factor = 10 ** Math.abs(exp)
  return Math.ceil(value * factor) / factor
}

const buildAttrKey = (
  selection: Record<string, string>,
  selects: MatrixSelect[]
) => {
  const entries = selects.map((select) => {
    const value = selection[select.aid]
    return `${select.aid}:${value}`
  })
  return entries.join("-")
}

const getMatrixPrice = (
  priceMap: Record<string, number>,
  keyBase: string,
  nmbVal: number,
  breakpoints: number[],
  options?: { scaleBelowMin?: boolean; scaleAboveMax?: boolean }
) => {
  if (!breakpoints.length) {
    return -1
  }

  const sorted = [...breakpoints].sort((a, b) => a - b)
  if (nmbVal <= sorted[0]) {
    const price = priceMap[`${keyBase}-${sorted[0]}`]
    if (!Number.isFinite(price)) {
      return -1
    }
    if (options?.scaleBelowMin && sorted[0] > 0) {
      return price * (nmbVal / sorted[0])
    }
    return price
  }
  if (nmbVal >= sorted[sorted.length - 1]) {
    const max = sorted[sorted.length - 1]
    const price = priceMap[`${keyBase}-${max}`]
    if (!Number.isFinite(price)) {
      return -1
    }
    if (options?.scaleAboveMax && max > 0) {
      return price * (nmbVal / max)
    }
    return price
  }

  let lower = sorted[0]
  let upper = sorted[sorted.length - 1]
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i]
    const next = sorted[i + 1]
    if (nmbVal >= current && nmbVal <= next) {
      lower = current
      upper = next
      break
    }
  }

  const lowerPrice = priceMap[`${keyBase}-${lower}`]
  const upperPrice = priceMap[`${keyBase}-${upper}`]

  if (!Number.isFinite(lowerPrice) || !Number.isFinite(upperPrice)) {
    return -1
  }

  if (lower === upper) {
    return lowerPrice
  }

  const ratio = (nmbVal - lower) / (upper - lower)
  return lowerPrice + (upperPrice - lowerPrice) * ratio
}

const getDefaultSelection = (selects: MatrixSelect[]) =>
  selects.reduce<Record<string, string>>((acc, select) => {
    const selected =
      select.options.find((option) => option.selected) ?? select.options[0]
    if (selected) {
      acc[select.aid] = selected.value
    }
    return acc
  }, {})

const calculateMatrixTotal = (
  data: CalculatorData,
  params: PriceCalculationParams
) => {
  const hasAreaSizing = data.matrices.some((matrix) => {
    const ntp = parseNumber(matrix.ntp) ?? 0
    return ntp === 2 || ntp === 3 || ntp === 4
  })

  const minQuantity = parseNumber(data.globals.min_quantity) ?? 1
  const minWidth = parseNumber(data.globals.min_width) ?? 1
  const minHeight = parseNumber(data.globals.min_height) ?? 1

  const quantity = params.quantity ?? minQuantity
  const width = hasAreaSizing ? params.width ?? minWidth : null
  const height = hasAreaSizing ? params.height ?? minHeight : null

  const selectionsByMatrix = params.selections ?? {}
  const dimUnit = data.globals.dim_unit ?? FALLBACK_DIM_UNIT

  const baseSizeEntry = (() => {
    const baseMatrix = data.matrices.find((matrix) => matrix.kind === "simple")
    if (!baseMatrix) return null
    const sizeSelect = baseMatrix.selects.find((select) =>
      select.class.includes("smatrix-size")
    )
    if (!sizeSelect) return null

    const selection =
      selectionsByMatrix[baseMatrix.mtid] ?? getDefaultSelection(baseMatrix.selects)
    const value = selection?.[sizeSelect.aid]
    return value ? `${sizeSelect.aid}:${value}` : null
  })()

  const finishingHasSize = (() => {
    if (!baseSizeEntry) {
      return false
    }
    const prefix = `${baseSizeEntry}-`
    return Object.keys(data.globals.fmatrix).some((key) => key.startsWith(prefix))
  })()

  const hiddenFinishingPair = (() => {
    const finishingAids = new Set<string>()
    const usedPairs = new Set<string>()
    for (const matrix of data.matrices) {
      if (matrix.kind !== "finishing") {
        continue
      }
      for (const select of matrix.selects) {
        finishingAids.add(select.aid)
        const selected =
          selectionsByMatrix[matrix.mtid]?.[select.aid] ??
          getDefaultSelection(matrix.selects)[select.aid]
        if (selected) {
          usedPairs.add(`${select.aid}:${selected}`)
        }
      }
    }

    const candidates: string[] = []
    for (const key of Object.keys(data.globals.fmatrix)) {
      const parts = key.split("-")
      if (finishingHasSize) {
        if (!baseSizeEntry) {
          continue
        }
        if (parts.length < 3 || parts[0] !== baseSizeEntry) {
          continue
        }
        candidates.push(parts[1])
        continue
      }
      if (parts.length < 2) {
        continue
      }
      candidates.push(parts[0])
    }

    const remaining = Array.from(
      new Set(candidates.filter((pair) => !usedPairs.has(pair)))
    )
    remaining.sort((a, b) => a.localeCompare(b))

    for (const pair of remaining) {
      const [aid] = pair.split(":")
      if (!finishingAids.has(aid)) {
        return pair
      }
    }

    return null
  })()

  const perMatrix = data.matrices.map((matrix) => {
    const ntp = parseNumber(matrix.ntp) ?? 0
    const breakpoints = parseBreakpoints(
      getNumbersEntry(data.globals.numbers_array, matrix.mtid)
    )
    const baseQuantity = quantity < minQuantity ? minQuantity : quantity
    const matrixAUnit =
      resolveAreaUnit(matrix.aUnit ?? data.globals.a_unit) ?? FALLBACK_A_UNIT
    const nmbVal = calculateQuantity(
      baseQuantity,
      width,
      height,
      ntp,
      dimUnit,
      matrixAUnit
    )

    if (nmbVal === null) {
      return { matrix, price: null, nmbVal: null }
    }

    const rounded =
      ntp === 2 || ntp === 3 || ntp === 4 ? ceilDecimal(nmbVal, -1) : nmbVal
    const scaleBelowMin = ntp === 2
    const priceMap =
      matrix.kind === "simple" ? data.globals.smatrix : data.globals.fmatrix

    if (matrix.kind === "finishing") {
      if (matrix.selects.length === 0) {
        if (!hiddenFinishingPair) {
          return { matrix, price: null, nmbVal: rounded }
        }
        const keyBase =
          finishingHasSize && baseSizeEntry
            ? `${baseSizeEntry}-${hiddenFinishingPair}`
            : hiddenFinishingPair
        const price = getMatrixPrice(priceMap, keyBase, rounded, breakpoints, {
          scaleBelowMin,
          scaleAboveMax: true,
        })
        return { matrix, price, nmbVal: rounded }
      }

      let totalPrice = 0
      for (const select of matrix.selects) {
        const selection =
          selectionsByMatrix[matrix.mtid] ?? getDefaultSelection(matrix.selects)
        const selected = selection?.[select.aid]
        if (!selected) {
          return { matrix, price: null, nmbVal: rounded }
        }
        const keyBase =
          finishingHasSize && baseSizeEntry
            ? `${baseSizeEntry}-${select.aid}:${selected}`
            : `${select.aid}:${selected}`
        const price = getMatrixPrice(priceMap, keyBase, rounded, breakpoints, {
          scaleBelowMin,
          scaleAboveMax: true,
        })
        if (price === -1) {
          return { matrix, price: -1, nmbVal: rounded }
        }
        totalPrice += price
      }

      return { matrix, price: totalPrice, nmbVal: rounded }
    }

    const selection =
      selectionsByMatrix[matrix.mtid] ?? getDefaultSelection(matrix.selects)
    const attrKey = buildAttrKey(selection, matrix.selects)
    const price = getMatrixPrice(priceMap, attrKey, rounded, breakpoints, {
      scaleBelowMin,
      scaleAboveMax: true,
    })

    return { matrix, price, nmbVal: rounded }
  })

  if (perMatrix.some((entry) => entry.price === -1 || entry.price === null)) {
    return null
  }

  let price = perMatrix.reduce((sum, entry) => sum + (entry.price ?? 0), 0)
  const productionSpeedPercent = params.productionSpeedPercent ?? 0
  const userDiscountPercent = params.userDiscountPercent ?? 0
  if (productionSpeedPercent !== 0) {
    price += price * (productionSpeedPercent / 100)
  }
  if (userDiscountPercent !== 0) {
    price -= price * (userDiscountPercent / 100)
  }
  return price
}

const parseBreakpointsValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
  }
  if (typeof value === "string") {
    return value
      .split(/[|,;\s]+/)
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item))
  }
  return []
}

const parseAttrsKey = (attrsKey: string) =>
  attrsKey
    .split("-")
    .map((part) => part.split(":"))
    .filter((pair) => pair.length === 2)
    .map(([aid, termId]) => ({ aid, termId }))

const buildCalculatorDataFromPricingModels = async (
  productId: string
): Promise<CalculatorData | null> => {
  const prisma = getPrisma()
  const models = await prisma.pricingModel.findMany({
    where: { productId, isActive: true },
    include: {
      entries: true,
    },
    orderBy: [{ sourceMtypeId: "asc" }],
  })

  if (models.length === 0) {
    return null
  }

  const attributeIds = new Set<string>()
  const termIds = new Set<string>()

  models.forEach((model) => {
    model.entries.forEach((entry) => {
      parseAttrsKey(entry.attrsKey).forEach(({ aid, termId }) => {
        attributeIds.add(aid)
        termIds.add(termId)
      })
    })
  })

  const [attributes, terms, termMeta] = await Promise.all([
    attributeIds.size
      ? prisma.wpAttributeTaxonomy.findMany({
          where: {
            attributeId: { in: Array.from(attributeIds).map(Number) },
          },
        })
      : [],
    termIds.size
      ? prisma.wpTerm.findMany({
          where: { termId: { in: Array.from(termIds).map(Number) } },
        })
      : [],
    termIds.size
      ? prisma.wpTermMeta.findMany({
          where: {
            termId: { in: Array.from(termIds).map(Number) },
            metaKey: { startsWith: "order" },
          },
        })
      : [],
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

  const matrices: Matrix[] = models.map((model) => {
    const mtid = String(model.sourceMtypeId)
    const kind: Matrix["kind"] =
      model.kind === "FINISHING" ? "finishing" : "simple"
    const ntp = String(model.numType ?? 0)
    const breakpoints =
      parseBreakpointsValue(model.breakpoints).length > 0
        ? parseBreakpointsValue(model.breakpoints)
        : Array.from(
            new Set(model.entries.map((entry) => entry.breakpoint))
          ).sort((a, b) => a - b)

    if (breakpoints.length > 0) {
      numbersArray[mtid] = breakpoints.join(",")
    }

    const aidsOrder = (() => {
      const firstKey = model.entries.find((entry) => entry.attrsKey)?.attrsKey
      if (!firstKey) return []
      return parseAttrsKey(firstKey).map(({ aid }) => aid)
    })()

    const aidSet = new Set<string>()
    model.entries.forEach((entry) => {
      parseAttrsKey(entry.attrsKey).forEach(({ aid }) => aidSet.add(aid))
    })
    const aids = aidsOrder.length > 0 ? aidsOrder : Array.from(aidSet)

    const selects: MatrixSelect[] = aids.map((aid) => {
      const attr = attributeById.get(aid)
      const attrLabel = attr?.attributeLabel ?? attr?.attributeName ?? ""
      const attrName = attr
        ? `${attr.attributeName} ${attr.attributeLabel}`
        : ""
      const termIdsByAid = new Set<string>()
      model.entries.forEach((entry) => {
        parseAttrsKey(entry.attrsKey).forEach((pair) => {
          if (pair.aid === aid) {
            termIdsByAid.add(pair.termId)
          }
        })
      })
      const options = Array.from(termIdsByAid)
        .map((termId) => {
          const term = termById.get(termId)
          return {
            value: termId,
            label: term?.name ?? termId,
            order: getTermOrder(termId, attr?.attributeName ?? null),
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
        aid,
        label: attrLabel || `Atribút ${aid}`,
        class: buildClass(kind, mtid, aid, attrName),
        options,
      }
    })

    model.entries.forEach((entry) => {
      const key = `${entry.attrsKey}-${entry.breakpoint}`
      const price = Number(entry.price.toString())
      if (kind === "finishing") {
        fmatrix[key] = price
      } else {
        smatrix[key] = price
      }
    })

    return {
      kind,
      mtid,
      ntp,
      numStyle:
        model.numStyle !== null && model.numStyle !== undefined
          ? String(model.numStyle)
          : null,
      aUnit: model.aUnit ?? null,
      material: null,
      selects,
      isActive: model.isActive ?? true,
    }
  })

  return {
    globals: {
      dim_unit: null,
      a_unit: null,
      min_quantity: null,
      min_width: null,
      min_height: null,
      numbers_array: numbersArray,
      smatrix,
      fmatrix,
    },
    matrices,
  }
}

export async function calculate(
  productId: string,
  params: PriceCalculationParams,
  audienceContext: AudienceContext
): Promise<PriceResult> {
  const prisma = getPrisma()
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      priceType: true,
      priceFrom: true,
      wpProductId: true,
    },
  })

  if (!product) {
    throw new Error("Produkt sa nenasiel.")
  }

  const settings = await getShopSettings()
  const vatRate = settings.vatRate
  const pricesIncludeVat = settings.pricesIncludeVat
  let net = null as number | null

  if (product.priceType === "FIXED") {
    net = product.priceFrom ? Number(product.priceFrom.toString()) : null
  } else if (product.wpProductId) {
    const calculatorData = await getWpCalculatorData(product.wpProductId, true)
    if (!calculatorData) {
      throw new Error("Pre tento produkt nie je dostupny cennik.")
    }
    net = calculateMatrixTotal(calculatorData, params)
  } else {
    const calculatorData = await buildCalculatorDataFromPricingModels(productId)
    if (calculatorData) {
      net = calculateMatrixTotal(calculatorData, params)
    } else {
      net = product.priceFrom ? Number(product.priceFrom.toString()) : null
    }
  }

  if (net === null || !Number.isFinite(net)) {
    throw new Error("Cenu sa nepodarilo vypocitat.")
  }

  let roundedNet = 0
  let vatAmount = 0
  let gross = 0

  if (pricesIncludeVat) {
    const roundedGross = roundCurrency(net)
    const netValue = roundedGross / (1 + vatRate)
    roundedNet = roundCurrency(netValue)
    vatAmount = roundCurrency(roundedGross - roundedNet)
    gross = roundedGross
  } else {
    roundedNet = roundCurrency(net)
    vatAmount = roundCurrency(roundedNet * vatRate)
    gross = roundCurrency(roundedNet + vatAmount)
  }

  return {
    net: roundedNet,
    vatAmount,
    gross,
    currency: "EUR",
    breakdown:
      audienceContext.audience === "b2b"
        ? { audience: "b2b", vatRate }
        : { audience: "b2c", vatRate },
  }
}
