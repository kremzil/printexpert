"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  Download,
  ShoppingCart,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  Layers,
  Sparkles,
  Palette,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { jsPDF } from "jspdf"

// ───── Types ─────────────────────────────────────────────
export interface DesignElement {
  id: string
  type: "text" | "image" | "shape"
  x: number
  y: number
  width: number
  height: number
  content?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  fontStyle?: string
  color?: string
  textAlign?: "left" | "center" | "right"
  backgroundColor?: string
  imageUrl?: string
  shapeType?: "rectangle" | "circle"
  borderRadius?: number
  rotation?: number
  visible?: boolean
  locked?: boolean
  strokeColor?: string
  strokeWidth?: number
}

export interface DesignTemplate {
  id: string
  name: string
  elements: DesignElement[]
}

export interface DesignEditorProps {
  /** Canvas width in px */
  width: number
  /** Canvas height in px */
  height: number
  /** DPI label to show */
  dpi?: number
  /** Color profile label */
  colorProfile?: string
  /** Product name for info bar */
  productLabel?: string
  /** Background color for canvas */
  bgColor?: string
  /** Predefined templates from DB */
  templates?: DesignTemplate[]
  /** Called when user clicks "Use in order" — receives elements + thumbnail data URL + PDF blob */
  onSave?: (elements: DesignElement[], thumbnailDataUrl?: string, pdfBlob?: Blob) => void
  /** Called when closing editor */
  onClose?: () => void
  /** Pre-loaded elements (e.g. from a previous save) */
  initialElements?: DesignElement[]
}

const FONTS = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Courier New",
  "Roboto",
  "Open Sans",
  "Montserrat",
]

// ───── Component ─────────────────────────────────────────
export function DesignEditor({
  width,
  height,
  dpi = 300,
  colorProfile = "CMYK",
  productLabel,
  bgColor = "#ffffff",
  templates = [],
  onSave,
  onClose,
  initialElements,
}: DesignEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [elements, setElements] = useState<DesignElement[]>(initialElements ?? [])
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; elX: number; elY: number; elW: number; elH: number; fontSize?: number } | null>(null)
  const [showLayers, setShowLayers] = useState(true)

  // Helper: draw a rounded rectangle path on any canvas context
  const roundedRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    const radius = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + w - radius, y)
    ctx.arcTo(x + w, y, x + w, y + radius, radius)
    ctx.lineTo(x + w, y + h - radius)
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
    ctx.lineTo(x + radius, y + h)
    ctx.arcTo(x, y + h, x, y + h - radius, radius)
    ctx.lineTo(x, y + radius)
    ctx.arcTo(x, y, x + radius, y, radius)
    ctx.closePath()
  }

  // Helper: draw a rounded rectangle (fill + optional stroke)
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, doStroke = false) => {
    roundedRectPath(ctx, x, y, w, h, r)
    ctx.fill()
    if (doStroke) ctx.stroke()
  }
  const [showTemplates, setShowTemplates] = useState(false)

  const selectedData = elements.find((el) => el.id === selectedElement)

  // Helpers for multi-selection
  const selectSingle = (id: string) => {
    setSelectedElement(id)
    setSelectedIds(new Set([id]))
  }
  const clearSelection = () => {
    setSelectedElement(null)
    setSelectedIds(new Set())
  }
  const toggleInSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        if (selectedElement === id) {
          setSelectedElement(next.size > 0 ? [...next][next.size - 1] : null)
        }
      } else {
        next.add(id)
        setSelectedElement(id)
      }
      return next
    })
  }

  // ───── Draw canvas ─────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, width, height)

    for (const element of elements) {
      if (!element.visible) continue
      ctx.save()

      if (element.rotation) {
        ctx.translate(
          element.x + element.width / 2,
          element.y + element.height / 2
        )
        ctx.rotate((element.rotation * Math.PI) / 180)
        ctx.translate(
          -(element.x + element.width / 2),
          -(element.y + element.height / 2)
        )
      }

      if (element.type === "shape") {
        const hasStroke = element.strokeColor && element.strokeWidth && element.strokeWidth > 0
        ctx.fillStyle = element.backgroundColor || "#cccccc"
        if (hasStroke) {
          ctx.strokeStyle = element.strokeColor!
          ctx.lineWidth = element.strokeWidth!
        }
        if (element.shapeType === "circle") {
          ctx.beginPath()
          ctx.ellipse(
            element.x + element.width / 2,
            element.y + element.height / 2,
            element.width / 2,
            element.height / 2,
            0, 0, Math.PI * 2
          )
          ctx.fill()
          if (hasStroke) ctx.stroke()
        } else if (element.borderRadius) {
          drawRoundedRect(ctx, element.x, element.y, element.width, element.height, element.borderRadius, !!hasStroke)
        } else {
          ctx.fillRect(element.x, element.y, element.width, element.height)
          if (hasStroke) ctx.strokeRect(element.x, element.y, element.width, element.height)
        }
      } else if (element.type === "text") {
        // Text background fill
        if (element.backgroundColor) {
          ctx.fillStyle = element.backgroundColor
          if (element.borderRadius) {
            drawRoundedRect(ctx, element.x - 2, element.y - 2, element.width + 4, element.height + 4, element.borderRadius)
          } else {
            ctx.fillRect(element.x - 2, element.y - 2, element.width + 4, element.height + 4)
          }
        }
        const hasStroke = element.strokeColor && element.strokeWidth && element.strokeWidth > 0
        ctx.fillStyle = element.color || "#000000"
        ctx.font = `${element.fontStyle === "italic" ? "italic " : ""}${element.fontWeight || "normal"} ${element.fontSize || 16}px ${element.fontFamily || "Arial"}`
        ctx.textBaseline = "top"
        const align = element.textAlign || "left"
        ctx.textAlign = align
        let textX = element.x
        if (align === "center") textX = element.x + element.width / 2
        if (align === "right") textX = element.x + element.width
        if (hasStroke) {
          ctx.strokeStyle = element.strokeColor!
          ctx.lineWidth = element.strokeWidth!
          ctx.lineJoin = "round"
          ctx.strokeText(element.content || "", textX, element.y, element.width)
        }
        ctx.fillText(element.content || "", textX, element.y, element.width)
      } else if (element.type === "image" && element.imageUrl) {
        const img = new Image()
        img.src = element.imageUrl
        img.onload = () => {
          ctx.drawImage(img, element.x, element.y, element.width, element.height)
        }
      }

      // selection indicator + resize handles
      if (selectedIds.has(element.id)) {
        ctx.strokeStyle = element.id === selectedElement ? "#0066cc" : "#0066cc80"
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(
          element.x - 2,
          element.y - 2,
          element.width + 4,
          element.height + 4
        )
        ctx.setLineDash([])

        // Draw resize handles only on the primary selected element
        if (element.id === selectedElement) {
          const hSize = 8
          const hHalf = hSize / 2
        ctx.fillStyle = "#ffffff"
        ctx.strokeStyle = "#0066cc"
        ctx.lineWidth = 1.5
        const ex = element.x - 2
        const ey = element.y - 2
        const ew = element.width + 4
        const eh = element.height + 4
        const handlePositions = [
          [ex - hHalf, ey - hHalf],                         // nw
          [ex + ew / 2 - hHalf, ey - hHalf],                // n
          [ex + ew - hHalf, ey - hHalf],                     // ne
          [ex + ew - hHalf, ey + eh / 2 - hHalf],           // e
          [ex + ew - hHalf, ey + eh - hHalf],               // se
          [ex + ew / 2 - hHalf, ey + eh - hHalf],           // s
          [ex - hHalf, ey + eh - hHalf],                     // sw
          [ex - hHalf, ey + eh / 2 - hHalf],                // w
        ]
        for (const [hx, hy] of handlePositions) {
          ctx.fillRect(hx, hy, hSize, hSize)
          ctx.strokeRect(hx, hy, hSize, hSize)
        }
        }
      }

      ctx.restore()
    }
  }, [elements, selectedElement, selectedIds, width, height, bgColor])

  // Auto-size text bounding boxes after canvas draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let changed = false
    const updated = elements.map((el) => {
      if (el.type !== "text" || !el.content) return el
      const font = `${el.fontStyle === "italic" ? "italic " : ""}${el.fontWeight || "normal"} ${el.fontSize || 16}px ${el.fontFamily || "Arial"}`
      ctx.font = font
      const metrics = ctx.measureText(el.content)
      const measuredW = Math.ceil(metrics.width) + 8 // small padding
      const measuredH = Math.ceil((el.fontSize || 16) * 1.3) + 4
      if (Math.abs(el.width - measuredW) > 2 || Math.abs(el.height - measuredH) > 2) {
        changed = true
        return { ...el, width: Math.max(measuredW, 20), height: Math.max(measuredH, 14) }
      }
      return el
    })
    if (changed) setElements(updated)
  }, [elements])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // ───── Element actions ─────
  const addText = () => {
    const el: DesignElement = {
      id: crypto.randomUUID(),
      type: "text",
      x: 50,
      y: 50,
      width: 200,
      height: 40,
      content: "Nový text",
      fontSize: 20,
      fontFamily: "Arial",
      color: "#000000",
      visible: true,
    }
    setElements((prev) => [...prev, el])
    selectSingle(el.id)
  }

  const addShape = (shapeType: "rectangle" | "circle") => {
    const size = shapeType === "circle" ? 150 : undefined
    const el: DesignElement = {
      id: crypto.randomUUID(),
      type: "shape",
      x: 50,
      y: 50,
      width: size ?? 150,
      height: size ?? 100,
      backgroundColor: "#0066cc",
      shapeType,
      visible: true,
    }
    setElements((prev) => [...prev, el])
    selectSingle(el.id)
  }

  const updateElement = (updates: Partial<DesignElement>) => {
    if (!selectedElement) return
    setElements((prev) =>
      prev.map((el) => (el.id === selectedElement ? { ...el, ...updates } : el))
    )
  }

  const deleteElement = () => {
    if (selectedIds.size === 0) return
    setElements((prev) => prev.filter((el) => !selectedIds.has(el.id)))
    clearSelection()
  }

  const duplicateElement = () => {
    if (selectedIds.size === 0) return
    const toDuplicate = elements.filter((el) => selectedIds.has(el.id))
    const newIds = new Set<string>()
    const copies = toDuplicate.map((src) => {
      const copy: DesignElement = {
        ...src,
        id: crypto.randomUUID(),
        x: src.x + 20,
        y: src.y + 20,
      }
      newIds.add(copy.id)
      return copy
    })
    setElements((prev) => [...prev, ...copies])
    setSelectedIds(newIds)
    setSelectedElement(copies.length > 0 ? copies[copies.length - 1].id : null)
  }

  // ───── Alignment helpers ─────
  const getSelectedElements = () => elements.filter((el) => selectedIds.has(el.id))

  const alignElements = (mode: "left" | "center-h" | "right" | "top" | "center-v" | "bottom") => {
    const selected = getSelectedElements()
    if (selected.length < 2) return
    const updates: Map<string, Partial<DesignElement>> = new Map()
    switch (mode) {
      case "left": {
        const minX = Math.min(...selected.map((el) => el.x))
        selected.forEach((el) => updates.set(el.id, { x: minX }))
        break
      }
      case "center-h": {
        const minX = Math.min(...selected.map((el) => el.x))
        const maxRight = Math.max(...selected.map((el) => el.x + el.width))
        const centerX = (minX + maxRight) / 2
        selected.forEach((el) => updates.set(el.id, { x: centerX - el.width / 2 }))
        break
      }
      case "right": {
        const maxRight = Math.max(...selected.map((el) => el.x + el.width))
        selected.forEach((el) => updates.set(el.id, { x: maxRight - el.width }))
        break
      }
      case "top": {
        const minY = Math.min(...selected.map((el) => el.y))
        selected.forEach((el) => updates.set(el.id, { y: minY }))
        break
      }
      case "center-v": {
        const minY = Math.min(...selected.map((el) => el.y))
        const maxBottom = Math.max(...selected.map((el) => el.y + el.height))
        const centerY = (minY + maxBottom) / 2
        selected.forEach((el) => updates.set(el.id, { y: centerY - el.height / 2 }))
        break
      }
      case "bottom": {
        const maxBottom = Math.max(...selected.map((el) => el.y + el.height))
        selected.forEach((el) => updates.set(el.id, { y: maxBottom - el.height }))
        break
      }
    }
    setElements((prev) =>
      prev.map((el) => {
        const u = updates.get(el.id)
        return u ? { ...el, ...u } : el
      })
    )
  }

  const distributeElements = (axis: "horizontal" | "vertical") => {
    const selected = getSelectedElements()
    if (selected.length < 3) return
    if (axis === "horizontal") {
      const sorted = [...selected].sort((a, b) => a.x - b.x)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const totalSpan = (last.x + last.width) - first.x
      const totalWidth = sorted.reduce((sum, el) => sum + el.width, 0)
      const gap = (totalSpan - totalWidth) / (sorted.length - 1)
      let currentX = first.x
      const updates = new Map<string, Partial<DesignElement>>()
      sorted.forEach((el) => {
        updates.set(el.id, { x: currentX })
        currentX += el.width + gap
      })
      setElements((prev) =>
        prev.map((el) => {
          const u = updates.get(el.id)
          return u ? { ...el, ...u } : el
        })
      )
    } else {
      const sorted = [...selected].sort((a, b) => a.y - b.y)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const totalSpan = (last.y + last.height) - first.y
      const totalHeight = sorted.reduce((sum, el) => sum + el.height, 0)
      const gap = (totalSpan - totalHeight) / (sorted.length - 1)
      let currentY = first.y
      const updates = new Map<string, Partial<DesignElement>>()
      sorted.forEach((el) => {
        updates.set(el.id, { y: currentY })
        currentY += el.height + gap
      })
      setElements((prev) =>
        prev.map((el) => {
          const u = updates.get(el.id)
          return u ? { ...el, ...u } : el
        })
      )
    }
  }

  const moveLayerUp = (id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((el) => el.id === id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  const moveLayerDown = (id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((el) => el.id === id)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx], next[idx - 1]] = [next[idx - 1], next[idx]]
      return next
    })
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const el: DesignElement = {
        id: crypto.randomUUID(),
        type: "image",
        x: 50,
        y: 50,
        width: 150,
        height: 150,
        imageUrl: ev.target?.result as string,
        visible: true,
      }
      setElements((prev) => [...prev, el])
      selectSingle(el.id)
    }
    reader.readAsDataURL(file)
  }

  const loadTemplate = (templateId: string) => {
    const tpl =
      templates.find((t) => t.id === templateId) ??
      builtInTemplates.find((t) => t.id === templateId)
    if (tpl) {
      setElements(tpl.elements)
      clearSelection()
      setShowTemplates(false)
    }
  }

  // ───── Resize handle hit-test ─────
  const HANDLE_SIZE = 8
  const HANDLE_NAMES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const
  type ResizeDir = typeof HANDLE_NAMES[number]

  const getHandleAtPoint = (x: number, y: number, el: DesignElement): ResizeDir | null => {
    const hHalf = HANDLE_SIZE / 2 + 2 // extra tolerance
    const ex = el.x - 2
    const ey = el.y - 2
    const ew = el.width + 4
    const eh = el.height + 4
    const positions: [number, number, ResizeDir][] = [
      [ex, ey, "nw"],
      [ex + ew / 2, ey, "n"],
      [ex + ew, ey, "ne"],
      [ex + ew, ey + eh / 2, "e"],
      [ex + ew, ey + eh, "se"],
      [ex + ew / 2, ey + eh, "s"],
      [ex, ey + eh, "sw"],
      [ex, ey + eh / 2, "w"],
    ]
    for (const [hx, hy, dir] of positions) {
      if (Math.abs(x - hx) <= hHalf && Math.abs(y - hy) <= hHalf) return dir
    }
    return null
  }

  const CURSOR_MAP: Record<ResizeDir, string> = {
    nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize", e: "ew-resize",
    se: "nwse-resize", s: "ns-resize", sw: "nesw-resize", w: "ew-resize",
  }

  // ───── Mouse interaction on canvas ─────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom

    // Check resize handles on selected element first
    if (selectedElement) {
      const sel = elements.find((el) => el.id === selectedElement)
      if (sel) {
        const handle = getHandleAtPoint(x, y, sel)
        if (handle) {
          setResizeHandle(handle)
          setResizeStart({ x, y, elX: sel.x, elY: sel.y, elW: sel.width, elH: sel.height, fontSize: sel.fontSize })
          return
        }
      }
    }

    const clicked = [...elements]
      .reverse()
      .find(
        (el) =>
          el.visible &&
          !el.locked &&
          x >= el.x &&
          x <= el.x + el.width &&
          y >= el.y &&
          y <= el.y + el.height
      )
    if (clicked) {
      const isMulti = e.shiftKey || e.ctrlKey || e.metaKey
      if (isMulti) {
        toggleInSelection(clicked.id)
      } else if (selectedIds.has(clicked.id) && selectedIds.size > 1) {
        // Clicked on an already-selected element within a group — keep group, set primary
        setSelectedElement(clicked.id)
      } else {
        selectSingle(clicked.id)
      }
      setIsDragging(true)
      setDragOffset({ x: x - clicked.x, y: y - clicked.y })
    } else {
      clearSelection()
      setIsDragging(false)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom

    // Resize mode
    if (resizeHandle && resizeStart && selectedElement) {
      const dx = x - resizeStart.x
      const dy = y - resizeStart.y
      const { elX, elY, elW, elH } = resizeStart
      const MIN_SIZE = 10
      let newX = elX, newY = elY, newW = elW, newH = elH

      if (resizeHandle.includes("e")) { newW = Math.max(MIN_SIZE, elW + dx) }
      if (resizeHandle.includes("w")) { newW = Math.max(MIN_SIZE, elW - dx); newX = elX + elW - newW }
      if (resizeHandle.includes("s")) { newH = Math.max(MIN_SIZE, elH + dy) }
      if (resizeHandle.includes("n")) { newH = Math.max(MIN_SIZE, elH - dy); newY = elY + elH - newH }

      // Shift = proportional resize (preserve aspect ratio)
      if (e.shiftKey && elW > 0 && elH > 0) {
        const aspect = elW / elH
        const isCorner = ["nw", "ne", "se", "sw"].includes(resizeHandle)
        const isHorizontal = ["e", "w"].includes(resizeHandle)
        if (isCorner || isHorizontal) {
          newH = Math.max(MIN_SIZE, newW / aspect)
        } else {
          newW = Math.max(MIN_SIZE, newH * aspect)
        }
        // Recalculate position for corners that move origin
        if (resizeHandle.includes("n")) { newY = elY + elH - newH }
        if (resizeHandle.includes("w")) { newX = elX + elW - newW }
      }

      // Scale font size proportionally for text elements
      const el = elements.find((e) => e.id === selectedElement)
      const updates: Partial<DesignElement> = { x: newX, y: newY, width: newW, height: newH }
      if (el?.type === "text" && resizeStart.fontSize) {
        const scale = newH / elH
        updates.fontSize = Math.max(6, Math.round(resizeStart.fontSize * scale))
      }

      setElements((prev) =>
        prev.map((el) => el.id === selectedElement ? { ...el, ...updates } : el)
      )
      return
    }

    // Update cursor for handle hover
    if (selectedElement && !isDragging) {
      const sel = elements.find((el) => el.id === selectedElement)
      if (sel) {
        const handle = getHandleAtPoint(x, y, sel)
        canvas.style.cursor = handle ? CURSOR_MAP[handle] : "crosshair"
      }
    }

    // Drag mode — move all selected elements
    if (!isDragging || !selectedElement) return
    const el = elements.find((e) => e.id === selectedElement)
    if (!el) return
    const newX = Math.max(0, Math.min(width - el.width, x - dragOffset.x))
    const newY = Math.max(0, Math.min(height - el.height, y - dragOffset.y))
    const dx = newX - el.x
    const dy = newY - el.y
    if (selectedIds.size > 1) {
      setElements((prev) =>
        prev.map((item) =>
          selectedIds.has(item.id)
            ? { ...item, x: item.x + dx, y: item.y + dy }
            : item
        )
      )
    } else {
      updateElement({ x: newX, y: newY })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setResizeHandle(null)
    setResizeStart(null)
  }

  // ───── Generate thumbnail ─────
  const generateThumbnail = useCallback((): string | undefined => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    // Create a small thumbnail canvas
    const thumbWidth = 400
    const thumbHeight = Math.round((height / width) * thumbWidth)
    const thumbCanvas = document.createElement("canvas")
    thumbCanvas.width = thumbWidth
    thumbCanvas.height = thumbHeight
    const ctx = thumbCanvas.getContext("2d")
    if (!ctx) return undefined
    ctx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight)
    return thumbCanvas.toDataURL("image/png", 0.85)
  }, [width, height])

  // ───── Generate PDF blob ─────
  const generatePdfBlob = useCallback((): Blob | undefined => {
    const widthMm = (width / dpi) * 25.4
    const heightMm = (height / dpi) * 25.4
    const orientation = widthMm > heightMm ? "landscape" as const : "portrait" as const

    const exportCanvas = document.createElement("canvas")
    exportCanvas.width = width
    exportCanvas.height = height
    const ctx = exportCanvas.getContext("2d")
    if (!ctx) return undefined

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, width, height)

    for (const el of elements) {
      if (el.visible === false) continue
      ctx.save()
      const hasStroke = el.strokeColor && el.strokeWidth && el.strokeWidth > 0
      if (el.type === "text") {
        if (el.backgroundColor) {
          ctx.fillStyle = el.backgroundColor
          if (el.borderRadius) {
            roundedRectPath(ctx, el.x - 2, el.y + (el.fontSize || 16) - (el.fontSize || 16) - 2, el.width + 4, el.height + 4, el.borderRadius)
            ctx.fill()
          } else {
            ctx.fillRect(el.x - 2, el.y + (el.fontSize || 16) - (el.fontSize || 16) - 2, el.width + 4, el.height + 4)
          }
        }
        const style = el.fontStyle === "italic" ? "italic" : ""
        const weight = el.fontWeight === "bold" ? "bold" : ""
        ctx.font = `${style} ${weight} ${el.fontSize || 16}px ${el.fontFamily || "Arial"}`
        ctx.fillStyle = el.color || "#000000"
        ctx.textAlign = (el.textAlign as CanvasTextAlign) || "left"
        const textX =
          el.textAlign === "center"
            ? el.x + el.width / 2
            : el.textAlign === "right"
              ? el.x + el.width
              : el.x
        if (hasStroke) {
          ctx.strokeStyle = el.strokeColor!
          ctx.lineWidth = el.strokeWidth!
          ctx.lineJoin = "round"
          ctx.strokeText(el.content || "", textX, el.y + (el.fontSize || 16))
        }
        ctx.fillText(el.content || "", textX, el.y + (el.fontSize || 16))
      } else if (el.type === "shape") {
        ctx.fillStyle = el.backgroundColor || "#cccccc"
        if (hasStroke) {
          ctx.strokeStyle = el.strokeColor!
          ctx.lineWidth = el.strokeWidth!
        }
        if (el.shapeType === "circle") {
          ctx.beginPath()
          ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2)
          ctx.fill()
          if (hasStroke) ctx.stroke()
        } else if (el.borderRadius) {
          drawRoundedRect(ctx, el.x, el.y, el.width, el.height, el.borderRadius, !!hasStroke)
        } else {
          ctx.fillRect(el.x, el.y, el.width, el.height)
          if (hasStroke) ctx.strokeRect(el.x, el.y, el.width, el.height)
        }
      }
      ctx.restore()
    }

    const pdf = new jsPDF({ orientation, unit: "mm", format: [widthMm, heightMm], compress: true })
    pdf.setProperties({
      title: `Design - ${productLabel || "export"}`,
      creator: "PrintExpert Design Studio",
      keywords: `DPI:${dpi}, Profile:${colorProfile}`,
    })
    const imgData = exportCanvas.toDataURL("image/png", 1.0)
    pdf.addImage(imgData, "PNG", 0, 0, widthMm, heightMm, undefined, "FAST")

    pdf.addPage([widthMm, heightMm], orientation)
    pdf.setFontSize(8)
    pdf.setTextColor(100, 100, 100)
    pdf.text(
      [
        `PrintExpert Design Studio`,
        `Produkt: ${productLabel || "-"}`,
        `Rozmer: ${widthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm`,
        `DPI: ${dpi}`,
        `Farebný profil: ${colorProfile}`,
        `Pixely: ${width} × ${height} px`,
        `Dátum: ${new Date().toLocaleDateString("sk-SK")}`,
      ],
      10,
      15
    )

    return pdf.output("blob")
  }, [elements, width, height, bgColor, productLabel, dpi, colorProfile])

  // ───── Use in order handler ─────
  const handleUseInOrder = useCallback(() => {
    if (!onSave) return
    const thumbnail = generateThumbnail()
    const pdfBlob = elements.length > 0 ? generatePdfBlob() : undefined
    onSave(elements, thumbnail, pdfBlob)
  }, [onSave, elements, generateThumbnail, generatePdfBlob])

  // ───── Download PDF ─────
  const handleDownloadPdf = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Physical dimensions: pixels / DPI * 25.4 = mm
    const widthMm = (width / dpi) * 25.4
    const heightMm = (height / dpi) * 25.4
    const orientation = widthMm > heightMm ? "landscape" as const : "portrait" as const

    // High-res export canvas (use the configured DPI)
    const exportCanvas = document.createElement("canvas")
    exportCanvas.width = width
    exportCanvas.height = height
    const ctx = exportCanvas.getContext("2d")
    if (!ctx) return

    // Draw background
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, width, height)

    // Draw each visible element
    for (const el of elements) {
      if (el.visible === false) continue
      ctx.save()
      const hasStroke = el.strokeColor && el.strokeWidth && el.strokeWidth > 0

      if (el.type === "text") {
        if (el.backgroundColor) {
          ctx.fillStyle = el.backgroundColor
          if (el.borderRadius) {
            roundedRectPath(ctx, el.x - 2, el.y + (el.fontSize || 16) - (el.fontSize || 16) - 2, el.width + 4, el.height + 4, el.borderRadius)
            ctx.fill()
          } else {
            ctx.fillRect(el.x - 2, el.y + (el.fontSize || 16) - (el.fontSize || 16) - 2, el.width + 4, el.height + 4)
          }
        }
        const style = el.fontStyle === "italic" ? "italic" : ""
        const weight = el.fontWeight === "bold" ? "bold" : ""
        ctx.font = `${style} ${weight} ${el.fontSize || 16}px ${el.fontFamily || "Arial"}`
        ctx.fillStyle = el.color || "#000000"
        ctx.textAlign = (el.textAlign as CanvasTextAlign) || "left"
        const textX =
          el.textAlign === "center"
            ? el.x + el.width / 2
            : el.textAlign === "right"
              ? el.x + el.width
              : el.x
        if (hasStroke) {
          ctx.strokeStyle = el.strokeColor!
          ctx.lineWidth = el.strokeWidth!
          ctx.lineJoin = "round"
          ctx.strokeText(el.content || "", textX, el.y + (el.fontSize || 16))
        }
        ctx.fillText(el.content || "", textX, el.y + (el.fontSize || 16))
      } else if (el.type === "shape") {
        ctx.fillStyle = el.backgroundColor || "#cccccc"
        if (hasStroke) {
          ctx.strokeStyle = el.strokeColor!
          ctx.lineWidth = el.strokeWidth!
        }
        if (el.shapeType === "circle") {
          ctx.beginPath()
          ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2)
          ctx.fill()
          if (hasStroke) ctx.stroke()
        } else if (el.borderRadius) {
          drawRoundedRect(ctx, el.x, el.y, el.width, el.height, el.borderRadius, !!hasStroke)
        } else {
          ctx.fillRect(el.x, el.y, el.width, el.height)
          if (hasStroke) ctx.strokeRect(el.x, el.y, el.width, el.height)
        }
      }
      ctx.restore()
    }

    // Create PDF with physical size
    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: [widthMm, heightMm],
      compress: true,
    })

    // Set document properties
    pdf.setProperties({
      title: `Design - ${productLabel || "export"}`,
      creator: "PrintExpert Design Studio",
      keywords: `DPI:${dpi}, Profile:${colorProfile}`,
    })

    // Place canvas image covering the full page
    const imgData = exportCanvas.toDataURL("image/png", 1.0)
    pdf.addImage(imgData, "PNG", 0, 0, widthMm, heightMm, undefined, "FAST")

    // Add production info as invisible metadata text on second page
    pdf.addPage([widthMm, heightMm], orientation)
    pdf.setFontSize(8)
    pdf.setTextColor(100, 100, 100)
    pdf.text(
      [
        `PrintExpert Design Studio`,
        `Produkt: ${productLabel || "-"}`,
        `Rozmer: ${widthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm`,
        `DPI: ${dpi}`,
        `Farebný profil: ${colorProfile}`,
        `Pixely: ${width} × ${height} px`,
        `Dátum: ${new Date().toLocaleDateString("sk-SK")}`,
      ],
      10,
      15
    )

    pdf.save(`design-${productLabel || "export"}.pdf`)
  }, [elements, width, height, bgColor, productLabel, dpi, colorProfile])

  // ───── Built-in templates ─────
  const builtInTemplates: DesignTemplate[] = [
    {
      id: "blank",
      name: "Prázdny dizajn",
      elements: [],
    },
    {
      id: "business-classic",
      name: "Klasická vizitka",
      elements: [
        {
          id: "t1",
          type: "shape",
          x: 0,
          y: 0,
          width,
          height: height / 2,
          backgroundColor: "#0066cc",
          shapeType: "rectangle",
          visible: true,
        },
        {
          id: "t2",
          type: "text",
          x: 30,
          y: 40,
          width: 200,
          height: 40,
          content: "Vaše meno",
          fontSize: 24,
          fontFamily: "Montserrat",
          fontWeight: "bold",
          color: "#ffffff",
          visible: true,
        },
        {
          id: "t3",
          type: "text",
          x: 30,
          y: 150,
          width: 200,
          height: 30,
          content: "Pozícia / Spoločnosť",
          fontSize: 16,
          fontFamily: "Arial",
          color: "#333333",
          visible: true,
        },
      ],
    },
    {
      id: "modern-minimal",
      name: "Moderná minimalistická",
      elements: [
        {
          id: "m1",
          type: "shape",
          x: 0,
          y: 180,
          width,
          height: 20,
          backgroundColor: "#0066cc",
          shapeType: "rectangle",
          visible: true,
        },
        {
          id: "m2",
          type: "text",
          x: 30,
          y: 40,
          width: 250,
          height: 50,
          content: "VAŠE MENO",
          fontSize: 28,
          fontFamily: "Montserrat",
          fontWeight: "bold",
          color: "#000000",
          visible: true,
        },
      ],
    },
  ]

  const allTemplates = [...builtInTemplates, ...templates]

  // ───── Render ──────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Info Bar */}
      <div className="flex items-center gap-3 border-b border-border bg-blue-50 px-4 py-2">
        <div className="flex items-center gap-1 rounded-full bg-linear-to-r from-purple-500 to-pink-500 px-2 py-0.5 text-xs font-semibold text-white">
          <Sparkles className="h-3 w-3" />
          Design Studio
        </div>
        <div className="flex items-center gap-1 text-sm text-foreground">
          <Palette className="h-4 w-4 text-muted-foreground" />
          {productLabel && <span>{productLabel} •</span>}
          <span>{((width / dpi) * 25.4).toFixed(0)} × {((height / dpi) * 25.4).toFixed(0)} mm</span>
          <span className="text-muted-foreground">•</span>
          <span>{width} × {height} px</span>
          <span className="text-muted-foreground">•</span>
          <span>{dpi} DPI • {colorProfile}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={addText}
            className="rounded-lg border border-border p-2 transition-all hover:bg-muted"
            title="Pridať text"
          >
            <Type className="h-5 w-5" />
          </button>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            id="design-image-upload"
          />
          <label
            htmlFor="design-image-upload"
            className="cursor-pointer rounded-lg border border-border p-2 transition-all hover:bg-muted"
            title="Nahrať obrázok"
          >
            <ImageIcon className="h-5 w-5" />
          </label>
          <button
            onClick={() => addShape("rectangle")}
            className="rounded-lg border border-border p-2 transition-all hover:bg-muted"
            title="Pridať obdĺžnik"
          >
            <Square className="h-5 w-5" />
          </button>
          <button
            onClick={() => addShape("circle")}
            className="rounded-lg border border-border p-2 transition-all hover:bg-muted"
            title="Pridať kruh"
          >
            <Circle className="h-5 w-5" />
          </button>

          <div className="mx-1.5 h-6 w-px bg-border" />

          <button
            onClick={duplicateElement}
            disabled={selectedIds.size === 0}
            className="rounded-lg border border-border p-2 transition-all hover:bg-muted disabled:opacity-30"
            title="Duplikovať"
          >
            <Copy className="h-5 w-5" />
          </button>
          <button
            onClick={deleteElement}
            disabled={selectedIds.size === 0}
            className="rounded-lg border border-border p-2 transition-all hover:bg-muted disabled:opacity-30"
            title="Vymazať"
          >
            <Trash2 className="h-5 w-5" />
          </button>

          <div className="mx-1.5 h-6 w-px bg-border" />

          <button
            className="rounded-lg border border-border p-2 transition-all hover:bg-muted"
            title="Späť"
          >
            <Undo className="h-5 w-5" />
          </button>
          <button
            className="rounded-lg border border-border p-2 transition-all hover:bg-muted"
            title="Vpred"
          >
            <Redo className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            className="rounded-lg border border-border p-2 transition-all hover:bg-muted"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="min-w-12.5 text-center text-sm font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className="rounded-lg border border-border p-2 transition-all hover:bg-muted"
          >
            <ZoomIn className="h-5 w-5" />
          </button>

          <div className="mx-1.5 h-6 w-px bg-border" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            Šablóny
          </Button>
          <Button
            size="sm"
            onClick={handleUseInOrder}
            disabled={elements.length === 0}
            className="bg-linear-to-r from-purple-600 to-pink-600 text-white shadow-md hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
          >
            <ShoppingCart className="mr-1.5 h-4 w-4" />
            Použiť v objednávke
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Download className="mr-1.5 h-4 w-4" />
            Stiahnuť PDF
          </Button>
          <Button
            variant={showLayers ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowLayers(v => !v)}
            title="Zobraziť/skryť vrstvy"
          >
            <Layers className="mr-1.5 h-4 w-4" />
            Vrstvy
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Properties */}
        {selectedElement && selectedData && selectedIds.size <= 1 && (
          <div className="w-72 shrink-0 overflow-y-auto border-r border-border bg-white p-4">
            <h3 className="mb-4 font-semibold">Vlastnosti</h3>

            {selectedData.type === "text" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Text</label>
                  <textarea
                    value={selectedData.content || ""}
                    onChange={(e) => updateElement({ content: e.target.value })}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Písmo</label>
                  <select
                    value={selectedData.fontFamily || "Arial"}
                    onChange={(e) => updateElement({ fontFamily: e.target.value })}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm"
                  >
                    {FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Veľkosť</label>
                  <input
                    type="number"
                    min={8}
                    max={72}
                    value={selectedData.fontSize || 16}
                    onChange={(e) => updateElement({ fontSize: parseInt(e.target.value) })}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Farba textu</label>
                  <input
                    type="color"
                    value={selectedData.color || "#000000"}
                    onChange={(e) => updateElement({ color: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-md border border-border"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Výplň pozadia</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedData.backgroundColor || "#ffffff"}
                      onChange={(e) => updateElement({ backgroundColor: e.target.value })}
                      className="h-10 flex-1 cursor-pointer rounded-md border border-border"
                    />
                    {selectedData.backgroundColor && (
                      <button
                        onClick={() => updateElement({ backgroundColor: undefined })}
                        className="rounded-md border border-border px-2 py-2 text-xs hover:bg-muted"
                        title="Odstrániť výplň"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Obvodka textu</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedData.strokeColor || "#000000"}
                      onChange={(e) => updateElement({ strokeColor: e.target.value, strokeWidth: selectedData.strokeWidth || 1 })}
                      className="h-10 flex-1 cursor-pointer rounded-md border border-border"
                    />
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={selectedData.strokeWidth || 0}
                      onChange={(e) => updateElement({ strokeWidth: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-16 rounded-md border border-border px-2 py-1.5 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">px</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Štýl</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        updateElement({
                          fontWeight: selectedData.fontWeight === "bold" ? "normal" : "bold",
                        })
                      }
                      className={cn(
                        "flex-1 rounded-md border p-2 transition-all",
                        selectedData.fontWeight === "bold" && "bg-muted"
                      )}
                    >
                      <Bold className="mx-auto h-4 w-4" />
                    </button>
                    <button
                      onClick={() =>
                        updateElement({
                          fontStyle:
                            selectedData.fontStyle === "italic" ? "normal" : "italic",
                        })
                      }
                      className={cn(
                        "flex-1 rounded-md border p-2 transition-all",
                        selectedData.fontStyle === "italic" && "bg-muted"
                      )}
                    >
                      <Italic className="mx-auto h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Zarovnanie</label>
                  <div className="flex gap-2">
                    {(["left", "center", "right"] as const).map((align) => (
                      <button
                        key={align}
                        onClick={() => updateElement({ textAlign: align })}
                        className={cn(
                          "flex-1 rounded-md border p-2 transition-all",
                          (selectedData.textAlign || "left") === align && "bg-muted"
                        )}
                      >
                        {align === "left" && <AlignLeft className="mx-auto h-4 w-4" />}
                        {align === "center" && <AlignCenter className="mx-auto h-4 w-4" />}
                        {align === "right" && <AlignRight className="mx-auto h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedData.type === "shape" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Výplň</label>
                  <input
                    type="color"
                    value={selectedData.backgroundColor || "#cccccc"}
                    onChange={(e) => updateElement({ backgroundColor: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-md border border-border"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Obvodka</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedData.strokeColor || "#000000"}
                      onChange={(e) => updateElement({ strokeColor: e.target.value, strokeWidth: selectedData.strokeWidth || 2 })}
                      className="h-10 flex-1 cursor-pointer rounded-md border border-border"
                    />
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={selectedData.strokeWidth || 0}
                      onChange={(e) => updateElement({ strokeWidth: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-16 rounded-md border border-border px-2 py-1.5 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">px</span>
                  </div>
                </div>
                {selectedData.shapeType === "rectangle" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">Zaoblenie rohov</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={Math.round(Math.min(selectedData.width, selectedData.height) / 2)}
                        value={selectedData.borderRadius || 0}
                        onChange={(e) => updateElement({ borderRadius: parseInt(e.target.value) })}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        min={0}
                        max={Math.round(Math.min(selectedData.width, selectedData.height) / 2)}
                        value={selectedData.borderRadius || 0}
                        onChange={(e) => updateElement({ borderRadius: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-16 rounded-md border border-border px-2 py-1.5 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">px</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Position & Size */}
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium">X</label>
                  <input
                    type="number"
                    value={Math.round(selectedData.x)}
                    onChange={(e) => updateElement({ x: parseInt(e.target.value) })}
                    className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Y</label>
                  <input
                    type="number"
                    value={Math.round(selectedData.y)}
                    onChange={(e) => updateElement({ y: parseInt(e.target.value) })}
                    className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Šírka</label>
                  <input
                    type="number"
                    value={Math.round(selectedData.width)}
                    onChange={(e) => updateElement({ width: parseInt(e.target.value) })}
                    className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Výška</label>
                  <input
                    type="number"
                    value={Math.round(selectedData.height)}
                    onChange={(e) => updateElement({ height: parseInt(e.target.value) })}
                    className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Multi-selection info */}
        {selectedIds.size > 1 && (
          <div className="w-72 shrink-0 overflow-y-auto border-r border-border bg-white p-4">
            <h3 className="mb-4 font-semibold">Výber</h3>
            <p className="text-sm text-muted-foreground">
              Vybraných: <span className="font-medium text-foreground">{selectedIds.size}</span> elementov
            </p>

            {/* Alignment */}
            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wide">Zarovnanie</label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => alignElements("left")}
                  className="rounded-md border border-border p-2 transition-all hover:bg-muted"
                  title="Zarovnať vľavo"
                >
                  <AlignStartVertical className="mx-auto h-4 w-4" />
                </button>
                <button
                  onClick={() => alignElements("center-h")}
                  className="rounded-md border border-border p-2 transition-all hover:bg-muted"
                  title="Zarovnať na stred horizontálne"
                >
                  <AlignCenterVertical className="mx-auto h-4 w-4" />
                </button>
                <button
                  onClick={() => alignElements("right")}
                  className="rounded-md border border-border p-2 transition-all hover:bg-muted"
                  title="Zarovnať vpravo"
                >
                  <AlignEndVertical className="mx-auto h-4 w-4" />
                </button>
                <button
                  onClick={() => alignElements("top")}
                  className="rounded-md border border-border p-2 transition-all hover:bg-muted"
                  title="Zarovnať nahor"
                >
                  <AlignStartHorizontal className="mx-auto h-4 w-4" />
                </button>
                <button
                  onClick={() => alignElements("center-v")}
                  className="rounded-md border border-border p-2 transition-all hover:bg-muted"
                  title="Zarovnať na stred vertikálne"
                >
                  <AlignCenterHorizontal className="mx-auto h-4 w-4" />
                </button>
                <button
                  onClick={() => alignElements("bottom")}
                  className="rounded-md border border-border p-2 transition-all hover:bg-muted"
                  title="Zarovnať nadol"
                >
                  <AlignEndHorizontal className="mx-auto h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Distribution */}
            {selectedIds.size >= 3 && (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wide">Rozloženie</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => distributeElements("horizontal")}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-border p-2 text-xs transition-all hover:bg-muted"
                    title="Rozložiť horizontálne"
                  >
                    <AlignCenterVertical className="h-3.5 w-3.5" />
                    Horizontálne
                  </button>
                  <button
                    onClick={() => distributeElements("vertical")}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-border p-2 text-xs transition-all hover:bg-muted"
                    title="Rozložiť vertikálne"
                  >
                    <AlignCenterHorizontal className="h-3.5 w-3.5" />
                    Vertikálne
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={duplicateElement}>
                <Copy className="mr-1.5 h-4 w-4" />
                Duplikovať
              </Button>
              <Button variant="destructive" size="sm" onClick={deleteElement}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                Vymazať
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Shift+klik alebo Ctrl+klik pre výber viacerých elementov
            </p>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-muted/30 p-8">
          <div
            className="mx-auto"
            style={{ width: width * zoom, height: height * zoom }}
          >
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={cn(
                "bg-white shadow-lg",
                isDragging ? "cursor-grabbing" : resizeHandle ? "" : "cursor-crosshair"
              )}
              style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
            />
          </div>
        </div>

        {/* Right sidebar — Layers */}
        {showLayers && (
          <div className="w-64 shrink-0 overflow-y-auto border-l border-border bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Vrstvy</h3>
              <button
                onClick={() => setShowLayers(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {[...elements].reverse().map((el, revIdx) => {
                const realIdx = elements.length - 1 - revIdx
                const isFirst = realIdx === 0
                const isLast = realIdx === elements.length - 1
                return (
                <button
                  key={el.id}
                  onClick={(e) => {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      toggleInSelection(el.id)
                    } else {
                      selectSingle(el.id)
                    }
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-all hover:bg-muted",
                    selectedElement === el.id && "border-primary ring-1 ring-primary",
                    selectedIds.has(el.id) && selectedElement !== el.id && "border-primary/50 bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {el.type === "text" && <Type className="h-3.5 w-3.5" />}
                    {el.type === "image" && <ImageIcon className="h-3.5 w-3.5" />}
                    {el.type === "shape" && <Square className="h-3.5 w-3.5" />}
                    <span className="truncate">
                      {el.type === "text" && (el.content || "Text")}
                      {el.type === "image" && "Obrázok"}
                      {el.type === "shape" &&
                        (el.shapeType === "rectangle" ? "Obdĺžnik" : "Kruh")}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isLast) moveLayerUp(el.id)
                      }}
                      className={cn("rounded p-0.5 hover:bg-muted-foreground/20", isLast && "pointer-events-none opacity-30")}
                      title="Posunúť nahor"
                    >
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isFirst) moveLayerDown(el.id)
                      }}
                      className={cn("rounded p-0.5 hover:bg-muted-foreground/20", isFirst && "pointer-events-none opacity-30")}
                      title="Posunúť nadol"
                    >
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedElement(el.id)
                        updateElement({ visible: !el.visible })
                      }}
                      className="rounded p-0.5 hover:bg-muted-foreground/20"
                    >
                      {el.visible !== false ? (
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>
                )
              })}
              {elements.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Žiadne vrstvy
                  <br />
                  Pridajte text alebo obrázok
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Vyberte šablónu</h2>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {allTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => loadTemplate(tpl.id)}
                  className="group overflow-hidden rounded-lg border-2 border-border transition-all hover:border-primary hover:shadow-lg"
                >
                  <div className="flex h-36 items-center justify-center bg-muted/30 p-4">
                    <div className="text-center">
                      <Layers className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
                      <div className="text-sm font-medium">{tpl.name}</div>
                    </div>
                  </div>
                  <div className="border-t border-border bg-white p-2 text-center text-sm font-medium group-hover:bg-muted/30">
                    Použiť šablónu
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
