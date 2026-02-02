"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ShoppingCart } from "lucide-react"

import { ModeButton } from "@/components/print/mode-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type PriceResult = {
  net: number
  vatAmount: number
  gross: number
  currency: "EUR"
}

type MatrixSelectOption = {
  value: string
  label: string
  selected?: boolean
}

type MatrixSelect = {
  aid: string
  label: string
  class: string
  options: MatrixSelectOption[]
}

type Matrix = {
  kind: "simple" | "finishing"
  mtid: string
  ntp: string
  numStyle: string | null
  aUnit: string | null
  material: string | null
  selects: MatrixSelect[]
  isActive: boolean
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

type PendingOrderUpload = {
  file: File
}

declare global {
  interface Window {
    __pendingOrderUpload?: PendingOrderUpload
  }
}

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

export function PriceCalculatorLetaky({
  data,
  productId,
}: {
  data: LetakyPricingData
  productId: string
}) {
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
  const [productionSpeedPercent, setProductionSpeedPercent] = useState(0)
  const [userDiscountPercent, setUserDiscountPercent] = useState(0)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [pendingUploadName, setPendingUploadName] = useState<string | null>(null)
  const [pendingUploadError, setPendingUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  const dimUnit = data.globals.dim_unit ?? FALLBACK_DIM_UNIT
  const orderMinPrice = null

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

  const perMatrix = useMemo(() => {
    return data.matrices.map((matrix) => {
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
          })
          return { matrix, price, nmbVal: rounded }
        }

        let totalPrice = 0
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
          totalPrice += price
        }

        return { matrix, price: totalPrice, nmbVal: rounded }
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
    data.globals.a_unit,
    data.matrices,
    baseSizeEntry,
    finishingHasSize,
    hiddenFinishingPair,
    selections,
    quantity,
    minQuantity,
    width,
    height,
    dimUnit,
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
  const visibleMatrices = useMemo(
    () => data.matrices.filter((matrix) => matrix.isActive !== false),
    [data.matrices]
  )

  const addToCart = async (uploadNow: boolean = false) => {
    setIsAddingToCart(true)
    setServerError(null)
    if (uploadNow) {
      setPendingUploadError(null)
    }

    try {
      // Формируем читаемый список выбранных свойств (только видимые матрицы)
      const selectedAttributes: Record<string, string> = {}
      
      for (const matrix of visibleMatrices) {
        const matrixSelections = selections[matrix.mtid] || {}
        
        for (const select of matrix.selects) {
          const selectedValue = matrixSelections[select.aid]
          if (selectedValue) {
            const option = select.options.find(opt => opt.value === selectedValue)
            if (option) {
              selectedAttributes[select.label] = option.label
            }
          }
        }
      }

      // Сначала получаем актуальную цену с сервера
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
            productionSpeedPercent,
            userDiscountPercent,
          },
        }),
      })

      if (!priceResponse.ok) {
        throw new Error("Не удалось рассчитать цену")
      }

      const priceResult = await priceResponse.json() as PriceResult
      const safeQuantity = quantity > 0 ? quantity : 1
      const perUnitPrice: PriceResult = {
        ...priceResult,
        net: priceResult.net / safeQuantity,
        vatAmount: priceResult.vatAmount / safeQuantity,
        gross: priceResult.gross / safeQuantity,
      }

      // Добавляем в корзину
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
            _attributes: selectedAttributes, // Добавляем читаемые названия
          },
          priceSnapshot: {
            ...perUnitPrice,
            calculatedAt: new Date().toISOString(),
          },
        }),
      })

      if (!cartResponse.ok) {
        throw new Error("Не удалось добавить в корзину")
      }

      // Обновляем badge корзины
      window.dispatchEvent(new Event("cart-updated"))

      router.push("/cart")
    } catch (error) {
      console.error("Add to cart error:", error)
      setServerError(
        error instanceof Error ? error.message : "Chyba pri pridávaní do košíka"
      )
    } finally {
      setIsAddingToCart(false)
    }
  }

  const handlePickUpload = () => {
    if (isAddingToCart || total === null || hasUnavailable) {
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    window.__pendingOrderUpload = { file }
    setPendingUploadName(file.name)
    setPendingUploadError(null)
    addToCart(true).catch(() => {
      setPendingUploadError("Nepodarilo sa pokračovať k objednávke.")
    })
    event.target.value = ""
  }

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5">
      <div className="grid gap-4">
        <label className="space-y-2 text-sm font-medium">
          Množstvo
          {useQuantitySelect ? (
            <Select
              value={String(quantity)}
              onValueChange={(value) => setQuantity(Number(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Vyberte…" />
              </SelectTrigger>
              <SelectContent>
                {baseBreakpoints.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <input
              type="number"
              min={minQuantity}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          )}
        </label>
        {hasAreaSizing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Šírka ({dimUnit})
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
              Výška ({dimUnit})
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
          </div>
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
        {visibleMatrices.map((matrix) => (
          <div key={matrix.mtid} className="space-y-3 rounded-md border p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {matrix.kind === "simple" ? "Tlač" : "Finalizácia"}
            </div>
            {matrix.selects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Táto položka sa vypočíta automaticky.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {matrix.selects.map((select) => (
                  <div key={select.aid} className="space-y-2">
                    <label className="text-sm font-medium">{select.label}</label>
                    <Select
                      value={selections[matrix.mtid]?.[select.aid] ?? ""}
                      onValueChange={(value) =>
                        setSelections((current) => ({
                          ...current,
                          [matrix.mtid]: {
                            ...(current[matrix.mtid] ?? {}),
                            [select.aid]: value,
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Vyberte…" />
                      </SelectTrigger>
                      <SelectContent>
                        {select.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Cena</span>
          {hasUnavailable ? (
            <span className="text-destructive">Kombinácia nie je dostupná.</span>
          ) : total === null ? (
            <span className="text-muted-foreground">Zadajte všetky údaje.</span>
          ) : (
            <span className="text-lg font-semibold">{total.toFixed(2)} €</span>
          )}
        </div>
        {serverError ? (
          <div className="text-sm text-destructive">{serverError}</div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <ModeButton
            type="button"
            className="sm:flex-1"
            onClick={handlePickUpload}
            disabled={isAddingToCart || total === null || hasUnavailable}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Nahrať grafiku a objednať
          </ModeButton>
          <ModeButton
            type="button"
            variant="outline"
            className="sm:flex-1"
            onClick={() => addToCart(false)}
            disabled={isAddingToCart || total === null || hasUnavailable}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Pridať do košíka
          </ModeButton>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.ai,.eps,.tiff,.tif,.png,.jpg,.jpeg,.svg"
          onChange={handleFileSelected}
        />
        {pendingUploadName && (
          <p className="text-xs text-muted-foreground">
            Vybraný súbor: {pendingUploadName}
          </p>
        )}
        {pendingUploadError && (
          <p className="text-xs text-destructive">{pendingUploadError}</p>
        )}
      </div>
    </section>
  )
}
