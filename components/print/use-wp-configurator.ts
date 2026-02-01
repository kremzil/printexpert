"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

export type WpConfiguratorData = {
  product_id: string
  globals: {
    dim_unit: string | null
    a_unit: number | string | null
    min_quantity: number | string | null
    min_width: number | string | null
    min_height: number | string | null
    max_width: number | string | null
    max_height: number | string | null
    numbers_array: Array<string | null> | Record<string, string | null>
    smatrix: Record<string, number>
    fmatrix: Record<string, number>
  }
  matrices: Array<{
    kind: "simple" | "finishing"
    mtid: string
    isActive: boolean
    ntp: string
    numStyle: string | null
    aUnit: string | null
    selects: Array<{
      aid: string
      label: string
      class: string
      options: Array<{
        value: string
        label: string
        selected?: boolean
      }>
    }>
  }>
}

type PriceResult = {
  net: number
  vatAmount: number
  gross: number
  currency: "EUR"
}

type MatrixSelectionMap = Record<string, Record<string, string>>

const FALLBACK_DIM_UNIT = "cm"
const FALLBACK_A_UNIT = 1

function parseNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveAreaUnit(value: string | number | null | undefined) {
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

function parseBreakpoints(value: string | null | undefined) {
  if (!value) {
    return []
  }
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))
}

function getNumbersEntry(
  numbersArray: Array<string | null> | Record<string, string | null>,
  mtid: string
) {
  if (Array.isArray(numbersArray)) {
    return numbersArray[Number(mtid)] ?? null
  }
  return numbersArray[mtid] ?? null
}

function normalizeDimensions(
  width: number,
  height: number,
  dimUnit: string,
  aUnit: string | number
) {
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

function calculateQuantity(
  quantity: number,
  width: number | null,
  height: number | null,
  ntp: number,
  dimUnit: string,
  aUnit: string | number
) {
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

function ceilDecimal(value: number, exp: number) {
  const factor = 10 ** Math.abs(exp)
  return Math.ceil(value * factor) / factor
}

function buildAttrKey(selection: Record<string, string>, selects: { aid: string }[]) {
  const entries = selects.map((select) => {
    const value = selection[select.aid]
    return `${select.aid}:${value}`
  })
  return entries.join("-")
}

function getMatrixPrice(
  priceMap: Record<string, number>,
  keyBase: string,
  nmbVal: number,
  breakpoints: number[],
  options?: { scaleBelowMin?: boolean }
) {
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
    const price = priceMap[`${keyBase}-${sorted[sorted.length - 1]}`]
    return Number.isFinite(price) ? price : -1
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

export function useWpConfigurator({
  data,
  productId,
}: {
  data: WpConfiguratorData
  productId: string
}) {
  const router = useRouter()

  const hasAreaSizing = data.matrices.some((matrix) => {
    const ntp = parseNumber(matrix.ntp) ?? 0
    return ntp === 2 || ntp === 3 || ntp === 4
  })

  const minQuantity = parseNumber(data.globals.min_quantity) ?? 1
  const minWidth = parseNumber(data.globals.min_width) ?? 1
  const minHeight = parseNumber(data.globals.min_height) ?? 1
  const baseMatrix =
    data.matrices.find((matrix) => matrix.kind === "simple") ?? data.matrices[0]
  const baseNumStyle = parseNumber(baseMatrix?.numStyle) ?? 0
  const baseNumType = parseNumber(baseMatrix?.ntp) ?? 0
  const baseBreakpoints = useMemo(() => {
    if (!baseMatrix) {
      return []
    }
    return parseBreakpoints(
      getNumbersEntry(data.globals.numbers_array, baseMatrix.mtid)
    ).sort((a, b) => a - b)
  }, [baseMatrix, data.globals.numbers_array])
  const useQuantitySelect =
    baseNumStyle === 1 && baseNumType === 0 && baseBreakpoints.length > 0
  const initialQuantity = useMemo(() => {
    if (!useQuantitySelect || baseBreakpoints.length === 0) {
      return minQuantity
    }
    const match =
      baseBreakpoints.find((value) => value >= minQuantity) ??
      baseBreakpoints[0]
    return match ?? minQuantity
  }, [baseBreakpoints, minQuantity, useQuantitySelect])

  const initialSelections = useMemo(() => {
    const selections: MatrixSelectionMap = {}

    for (const matrix of data.matrices) {
      const matrixSelections: Record<string, string> = {}
      for (const select of matrix.selects) {
        const selected =
          select.options.find((option) => option.selected) ?? select.options[0]
        if (selected) {
          matrixSelections[select.aid] = selected.value
        }
      }
      selections[matrix.mtid] = matrixSelections
    }

    return selections
  }, [data.matrices])

  const [selections, setSelections] = useState(initialSelections)
  const [quantity, setQuantity] = useState(initialQuantity)
  const [width, setWidth] = useState<number | null>(
    hasAreaSizing ? minWidth : null
  )
  const [height, setHeight] = useState<number | null>(
    hasAreaSizing ? minHeight : null
  )
  const [serverError, setServerError] = useState<string | null>(null)
  const [isAddingToCart, setIsAddingToCart] = useState(false)

  const dimUnit = data.globals.dim_unit ?? FALLBACK_DIM_UNIT

  useEffect(() => {
    setQuantity(initialQuantity)
  }, [initialQuantity])

  const baseSizeEntry = useMemo(() => {
    const baseMatrix = data.matrices.find((matrix) => matrix.kind === "simple")
    if (!baseMatrix) {
      return null
    }
    const sizeSelect = baseMatrix.selects.find((select) =>
      select.class.includes("smatrix-size")
    )
    if (!sizeSelect) {
      return null
    }

    const selection = selections[baseMatrix.mtid]
    const value = selection?.[sizeSelect.aid]
    return value ? `${sizeSelect.aid}:${value}` : null
  }, [data.matrices, selections])

  const finishingHasSize = useMemo(() => {
    if (!baseSizeEntry) {
      return false
    }
    const prefix = `${baseSizeEntry}-`
    return Object.keys(data.globals.fmatrix).some((key) =>
      key.startsWith(prefix)
    )
  }, [baseSizeEntry, data.globals.fmatrix])

  const hiddenFinishingPair = useMemo(() => {
    const finishingAids = new Set<string>()
    const usedPairs = new Set<string>()
    for (const matrix of data.matrices) {
      if (matrix.kind !== "finishing") {
        continue
      }
      for (const select of matrix.selects) {
        finishingAids.add(select.aid)
        const selected = selections[matrix.mtid]?.[select.aid]
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
  }, [
    baseSizeEntry,
    data.globals.fmatrix,
    data.matrices,
    finishingHasSize,
    selections,
  ])

  const calculatePerMatrix = (
    overrideQuantity?: number,
    overrideWidth?: number | null,
    overrideHeight?: number | null
  ) => {
    const selectedQuantity = overrideQuantity ?? quantity
    const selectedWidth = overrideWidth ?? width
    const selectedHeight = overrideHeight ?? height

    return data.matrices.map((matrix) => {
      const ntp = parseNumber(matrix.ntp) ?? 0
      const breakpoints = parseBreakpoints(
        getNumbersEntry(data.globals.numbers_array, matrix.mtid)
      )
      const baseQuantity =
        selectedQuantity < minQuantity ? minQuantity : selectedQuantity
      const matrixAUnit =
        resolveAreaUnit(matrix.aUnit ?? data.globals.a_unit) ?? FALLBACK_A_UNIT
      const nmbVal = calculateQuantity(
        baseQuantity,
        selectedWidth,
        selectedHeight,
        ntp,
        dimUnit,
        matrixAUnit
      )

      if (nmbVal === null) {
        return { matrix, price: null }
      }

      const rounded =
        ntp === 2 || ntp === 3 || ntp === 4 ? ceilDecimal(nmbVal, -1) : nmbVal
      const scaleBelowMin = ntp === 2
      const priceMap =
        matrix.kind === "simple" ? data.globals.smatrix : data.globals.fmatrix

      if (matrix.kind === "finishing") {
        if (matrix.selects.length === 0) {
          if (!hiddenFinishingPair) {
            return { matrix, price: null }
          }
          const keyBase =
            finishingHasSize && baseSizeEntry
              ? `${baseSizeEntry}-${hiddenFinishingPair}`
              : hiddenFinishingPair
          const price = getMatrixPrice(priceMap, keyBase, rounded, breakpoints, {
            scaleBelowMin,
          })
          return { matrix, price }
        }

        let totalPrice = 0
        for (const select of matrix.selects) {
          const selected = selections[matrix.mtid]?.[select.aid]
          if (!selected) {
            return { matrix, price: null }
          }
          const keyBase =
            finishingHasSize && baseSizeEntry
              ? `${baseSizeEntry}-${select.aid}:${selected}`
              : `${select.aid}:${selected}`
          const price = getMatrixPrice(priceMap, keyBase, rounded, breakpoints, {
            scaleBelowMin,
          })
          if (price === -1) {
            return { matrix, price: -1 }
          }
          totalPrice += price
        }

        return { matrix, price: totalPrice }
      }

      const selection = selections[matrix.mtid] ?? {}
      const attrKey = buildAttrKey(selection, matrix.selects)
      const price = getMatrixPrice(priceMap, attrKey, rounded, breakpoints, {
        scaleBelowMin,
      })

      return { matrix, price }
    })
  }

  const perMatrix = useMemo(() => calculatePerMatrix(), [selections, quantity, width, height])

  const total = useMemo(() => {
    if (perMatrix.some((entry) => entry.price === -1 || entry.price === null)) {
      return null
    }

    return perMatrix.reduce((sum, entry) => sum + (entry.price ?? 0), 0)
  }, [perMatrix])

  const hasUnavailable = perMatrix.some((entry) => entry.price === -1)
  const visibleMatrices = useMemo(
    () => data.matrices.filter((matrix) => matrix.isActive !== false),
    [data.matrices]
  )

  const summaryItems = useMemo(() => {
    const items: Array<{ label: string; value: string }> = []
    for (const matrix of visibleMatrices) {
      for (const select of matrix.selects) {
        const selectedValue = selections[matrix.mtid]?.[select.aid]
        if (!selectedValue) continue
        const option = select.options.find(
          (item) => item.value === selectedValue
        )
        if (!option) continue
        items.push({ label: select.label, value: option.label })
      }
    }
    return items
  }, [selections, visibleMatrices])

  const defaultPresets = [100, 250, 500, 1000, 2500]
  const quantityPresets = useMemo(() => {
    if (baseBreakpoints.length > 0) {
      return baseBreakpoints
    }
    const filtered = defaultPresets.filter((value) => value >= minQuantity)
    if (filtered[0] !== minQuantity) {
      return [minQuantity, ...filtered]
    }
    return filtered
  }, [baseBreakpoints, minQuantity])

  const getTotalForQuantity = (value: number) => {
    const list = calculatePerMatrix(value)
    if (list.some((entry) => entry.price === -1 || entry.price === null)) {
      return null
    }
    return list.reduce((sum, entry) => sum + (entry.price ?? 0), 0)
  }

  const addToCart = async () => {
    if (isAddingToCart || total === null || hasUnavailable) {
      return
    }
    setIsAddingToCart(true)
    setServerError(null)

    try {
      const selectedAttributes: Record<string, string> = {}

      for (const matrix of visibleMatrices) {
        const matrixSelections = selections[matrix.mtid] || {}

        for (const select of matrix.selects) {
          const selectedValue = matrixSelections[select.aid]
          if (selectedValue) {
            const option = select.options.find(
              (opt) => opt.value === selectedValue
            )
            if (option) {
              selectedAttributes[select.label] = option.label
            }
          }
        }
      }

      const priceResponse = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          params: {
            quantity,
            width,
            height,
            selections,
          },
        }),
      })

      if (!priceResponse.ok) {
        throw new Error("Nepodarilo sa vypočítať cenu")
      }

      const priceResult = (await priceResponse.json()) as PriceResult
      const safeQuantity = quantity > 0 ? quantity : 1
      const perUnitPrice: PriceResult = {
        ...priceResult,
        net: priceResult.net / safeQuantity,
        vatAmount: priceResult.vatAmount / safeQuantity,
        gross: priceResult.gross / safeQuantity,
      }

      const cartResponse = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantity,
          width,
          height,
          selectedOptions: {
            ...selections,
            _attributes: selectedAttributes,
          },
          priceSnapshot: {
            ...perUnitPrice,
            calculatedAt: new Date().toISOString(),
          },
        }),
      })

      if (!cartResponse.ok) {
        throw new Error("Nepodarilo sa pridať do košíka")
      }

      window.dispatchEvent(new Event("cart-updated"))
      router.push("/cart")
    } catch (error) {
      console.error("Add to cart error:", error)
      setServerError(
        error instanceof Error
          ? error.message
          : "Chyba pri pridávaní do košíka"
      )
    } finally {
      setIsAddingToCart(false)
    }
  }

  return {
    selections,
    setSelections,
    quantity,
    setQuantity,
    width,
    height,
    setWidth,
    setHeight,
    minQuantity,
    minWidth,
    minHeight,
    dimUnit,
    hasAreaSizing,
    useQuantitySelect,
    visibleMatrices,
    total,
    hasUnavailable,
    summaryItems,
    quantityPresets,
    getTotalForQuantity,
    addToCart,
    isAddingToCart,
    serverError,
  }
}
