export type MillimeterBox = {
  top: number
  right: number
  bottom: number
  left: number
}

export type TrimSizeMm = {
  width: number
  height: number
}

export type DesignDataV2 = {
  canvasProfileId: string
  sizeKey: string | null
  trimMm: TrimSizeMm
  bleedMm: MillimeterBox
  safeMm: MillimeterBox
  dpi: number
  elements: unknown[]
}

export type DesignCanvasProfileRuntime = {
  id: string
  productId: string
  name: string
  sizeAid: string | null
  sizeTermId: string | null
  sizeLabel: string | null
  trimWidthMm: number
  trimHeightMm: number
  dpi: number
  bgColor: string
  colorProfile: string
  bleedTopMm: number
  bleedRightMm: number
  bleedBottomMm: number
  bleedLeftMm: number
  safeTopMm: number
  safeRightMm: number
  safeBottomMm: number
  safeLeftMm: number
  sortOrder: number
  isActive: boolean
}

export type DesignTemplateRuntime = {
  id: string
  productId: string
  canvasProfileId: string
  name: string
  elements: unknown
  thumbnailUrl: string | null
  isDefault: boolean
  sortOrder: number
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const readNumber = (value: unknown, fallback = 0) =>
  isFiniteNumber(value) ? value : fallback

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

export const asMillimeterBox = (value: unknown): MillimeterBox => {
  if (!isObject(value)) {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }
  return {
    top: readNumber(value.top),
    right: readNumber(value.right),
    bottom: readNumber(value.bottom),
    left: readNumber(value.left),
  }
}

export const asTrimSizeMm = (value: unknown): TrimSizeMm => {
  if (!isObject(value)) {
    return { width: 0, height: 0 }
  }
  return {
    width: readNumber(value.width),
    height: readNumber(value.height),
  }
}

export const isDesignDataV2 = (value: unknown): value is DesignDataV2 => {
  if (!isObject(value)) return false
  if (typeof value.canvasProfileId !== "string") return false
  if (value.sizeKey !== null && typeof value.sizeKey !== "string") return false
  if (!Array.isArray(value.elements)) return false
  if (!isObject(value.trimMm)) return false
  if (!isObject(value.bleedMm)) return false
  if (!isObject(value.safeMm)) return false
  return true
}

export const normalizeDesignDataV2 = (value: unknown): DesignDataV2 | null => {
  if (!isDesignDataV2(value)) return null
  return {
    canvasProfileId: value.canvasProfileId,
    sizeKey: value.sizeKey ?? null,
    trimMm: asTrimSizeMm(value.trimMm),
    bleedMm: asMillimeterBox(value.bleedMm),
    safeMm: asMillimeterBox(value.safeMm),
    dpi: readNumber(value.dpi, 300),
    elements: Array.isArray(value.elements) ? value.elements : [],
  }
}

export const extractDesignElements = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value
  const normalized = normalizeDesignDataV2(value)
  return normalized?.elements ?? []
}

export const getDesignElementCount = (value: unknown): number =>
  extractDesignElements(value).length
