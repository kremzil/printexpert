"use client"

import { useMemo, useState } from "react"

type MatrixSelectOption = {
  value: string
  label: string
  selected?: boolean
}

type MatrixSelect = {
  aid: string
  name: string
  class: string
  options: MatrixSelectOption[]
}

type Matrix = {
  kind: "simple" | "finishing"
  mtid: string
  ntp: string
  material: string | null
  selects: MatrixSelect[]
}

type PricingGlobals = {
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

type LetakyPricingData = {
  product_id: string
  globals: PricingGlobals
  matrices: Matrix[]
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
  aUnit: number
) {
  if (dimUnit === "cm") {
    if (aUnit !== 1) {
      return { width: width / 100, height: height / 100 }
    }
    return { width, height }
  }

  if (dimUnit === "mm") {
    return { width: width / 10, height: height / 10 }
  }

  return { width, height }
}

function calculateQuantity(
  quantity: number,
  width: number | null,
  height: number | null,
  ntp: number,
  dimUnit: string,
  aUnit: number
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

function buildAttrKey(selection: Record<string, string>, selects: MatrixSelect[]) {
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

export function PriceCalculatorLetaky({ data }: { data: LetakyPricingData }) {
  const hasAreaSizing = data.matrices.some((matrix) => {
    const ntp = parseNumber(matrix.ntp) ?? 0
    return ntp === 2 || ntp === 3 || ntp === 4
  })

  const minQuantity = parseNumber(data.globals.min_quantity) ?? 1
  const minWidth = parseNumber(data.globals.min_width) ?? 1
  const minHeight = parseNumber(data.globals.min_height) ?? 1

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
  const [quantity, setQuantity] = useState(minQuantity)
  const [width, setWidth] = useState<number | null>(
    hasAreaSizing ? minWidth : null
  )
  const [height, setHeight] = useState<number | null>(
    hasAreaSizing ? minHeight : null
  )
  const [productionSpeedPercent, setProductionSpeedPercent] = useState(0)
  const [userDiscountPercent, setUserDiscountPercent] = useState(0)

  const dimUnit = data.globals.dim_unit ?? FALLBACK_DIM_UNIT
  const aUnit = parseNumber(data.globals.a_unit) ?? FALLBACK_A_UNIT
  const orderMinPrice = null
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

  const perMatrix = useMemo(() => {
    return data.matrices.map((matrix) => {
        const ntp = parseNumber(matrix.ntp) ?? 0
        const breakpoints = parseBreakpoints(
          getNumbersEntry(data.globals.numbers_array, matrix.mtid)
        )
        const baseQuantity = quantity < minQuantity ? minQuantity : quantity
        const nmbVal = calculateQuantity(
          baseQuantity,
          width,
          height,
          ntp,
          dimUnit,
          aUnit
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
            })
            return { matrix, price, nmbVal: rounded }
          }

          let total = 0
          for (const select of matrix.selects) {
            const selected = selections[matrix.mtid]?.[select.aid]
            if (!selected) {
              return { matrix, price: null, nmbVal: rounded }
            }
            const keyBase =
              finishingHasSize && baseSizeEntry
                ? `${baseSizeEntry}-${select.aid}:${selected}`
                : `${select.aid}:${selected}`
            const price = getMatrixPrice(priceMap, keyBase, rounded, breakpoints, {
              scaleBelowMin,
            })
            if (price === -1) {
              return { matrix, price: -1, nmbVal: rounded }
            }
            total += price
          }

          return { matrix, price: total, nmbVal: rounded }
        }

        const selection = selections[matrix.mtid] ?? {}
        const attrKey = buildAttrKey(selection, matrix.selects)
        const price = getMatrixPrice(priceMap, attrKey, rounded, breakpoints, {
          scaleBelowMin,
        })

        return { matrix, price, nmbVal: rounded }
    })
  }, [
    data.globals.fmatrix,
    data.globals.numbers_array,
    data.globals.smatrix,
    data.matrices,
    finishingHasSize,
    hiddenFinishingPair,
    selections,
    quantity,
    minQuantity,
    width,
    height,
    dimUnit,
    aUnit,
  ])

  const total = useMemo(() => {
    if (perMatrix.some((entry) => entry.price === -1 || entry.price === null)) {
      return null
    }

    let price = perMatrix.reduce((sum, entry) => sum + (entry.price ?? 0), 0)
    if (productionSpeedPercent !== 0) {
      price += price * (productionSpeedPercent / 100)
    }
    if (userDiscountPercent !== 0) {
      price -= price * (userDiscountPercent / 100)
    }
    if (orderMinPrice !== null && price < orderMinPrice) {
      price = orderMinPrice
    }
    return price
  }, [perMatrix, productionSpeedPercent, userDiscountPercent, orderMinPrice])

  const hasUnavailable = perMatrix.some((entry) => entry.price === -1)

  return (
    <section className="space-y-6 rounded-xl border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Kalkulačka ceny (test)</h2>
        <p className="text-sm text-muted-foreground">
          Tento nahlad pouziva WP2Print exportovane data.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Množstvo
          <input
            type="number"
            min={minQuantity}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>
        {hasAreaSizing ? (
          <>
            <label className="space-y-2 text-sm font-medium">
              S¡rka ({dimUnit})
              <input
                type="number"
                min={minWidth}
                value={width ?? ""}
                onChange={(event) =>
                  setWidth(
                    event.target.value === "" ? null : Number(event.target.value)
                  )
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Vìska ({dimUnit})
              <input
                type="number"
                min={minHeight}
                value={height ?? ""}
                onChange={(event) =>
                  setHeight(
                    event.target.value === "" ? null : Number(event.target.value)
                  )
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
          </>
        ) : null}
        <label className="space-y-2 text-sm font-medium">
          Expresná výroba (%)
          <input
            type="number"
            min={0}
            value={productionSpeedPercent}
            onChange={(event) => setProductionSpeedPercent(Number(event.target.value))}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Zľava používateľa (%)
          <input
            type="number"
            min={0}
            value={userDiscountPercent}
            onChange={(event) => setUserDiscountPercent(Number(event.target.value))}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="space-y-4">
        {data.matrices.map((matrix) => (
          <div key={matrix.mtid} className="space-y-2 rounded-md border p-4">
            <div className="text-sm font-semibold">
              {matrix.kind === "simple" ? "Tlač" : "Finalizácia"} (mtid{" "}
              {matrix.mtid})
            </div>
            {matrix.selects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
          Tento nahlad pouziva WP2Print exportovane data.
        </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {matrix.selects.map((select) => (
                  <label key={select.aid} className="text-sm font-medium">
                    {select.name}
                    <select
                      value={selections[matrix.mtid]?.[select.aid] ?? ""}
                      onChange={(event) =>
                        setSelections((current) => ({
                          ...current,
                          [matrix.mtid]: {
                            ...(current[matrix.mtid] ?? {}),
                            [select.aid]: event.target.value,
                          },
                        }))
                      }
                      className="mt-2 w-full rounded-md border px-3 py-2 text-sm"
                    >
                      {select.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-md border px-4 py-3 text-sm">
        {hasUnavailable ? (
          <div className="text-destructive">N/A - kombinácia nie je dostupná.</div>
        ) : total === null ? (
          <div className="text-muted-foreground">Zadajte všetky údaje.</div>
        ) : (
          <div className="text-lg font-semibold">
            Výsledná cena: {total.toFixed(2)} €
          </div>
        )}
      </div>
    </section>
  )
}
