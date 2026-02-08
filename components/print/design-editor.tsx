"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  Download,
  Save,
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
  Layers,
  Sparkles,
  Palette,
  X,
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
  rotation?: number
  visible?: boolean
  locked?: boolean
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
  /** Called when user saves design */
  onSave?: (elements: DesignElement[]) => void
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
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showLayers, setShowLayers] = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)

  const selectedData = elements.find((el) => el.id === selectedElement)

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
        ctx.fillStyle = element.backgroundColor || "#cccccc"
        if (element.shapeType === "circle") {
          ctx.beginPath()
          ctx.arc(
            element.x + element.width / 2,
            element.y + element.height / 2,
            Math.min(element.width, element.height) / 2,
            0,
            Math.PI * 2
          )
          ctx.fill()
        } else {
          ctx.fillRect(element.x, element.y, element.width, element.height)
        }
      } else if (element.type === "text") {
        ctx.fillStyle = element.color || "#000000"
        ctx.font = `${element.fontStyle === "italic" ? "italic " : ""}${element.fontWeight || "normal"} ${element.fontSize || 16}px ${element.fontFamily || "Arial"}`
        ctx.textBaseline = "top"
        const align = element.textAlign || "left"
        ctx.textAlign = align
        let textX = element.x
        if (align === "center") textX = element.x + element.width / 2
        if (align === "right") textX = element.x + element.width
        ctx.fillText(element.content || "", textX, element.y, element.width)
      } else if (element.type === "image" && element.imageUrl) {
        const img = new Image()
        img.src = element.imageUrl
        img.onload = () => {
          ctx.drawImage(img, element.x, element.y, element.width, element.height)
        }
      }

      // selection indicator
      if (element.id === selectedElement) {
        ctx.strokeStyle = "#0066cc"
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(
          element.x - 2,
          element.y - 2,
          element.width + 4,
          element.height + 4
        )
        ctx.setLineDash([])
      }

      ctx.restore()
    }
  }, [elements, selectedElement, width, height, bgColor])

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
    setSelectedElement(el.id)
  }

  const addShape = (shapeType: "rectangle" | "circle") => {
    const el: DesignElement = {
      id: crypto.randomUUID(),
      type: "shape",
      x: 50,
      y: 50,
      width: 150,
      height: 100,
      backgroundColor: "#0066cc",
      shapeType,
      visible: true,
    }
    setElements((prev) => [...prev, el])
    setSelectedElement(el.id)
  }

  const updateElement = (updates: Partial<DesignElement>) => {
    if (!selectedElement) return
    setElements((prev) =>
      prev.map((el) => (el.id === selectedElement ? { ...el, ...updates } : el))
    )
  }

  const deleteElement = () => {
    if (!selectedElement) return
    setElements((prev) => prev.filter((el) => el.id !== selectedElement))
    setSelectedElement(null)
  }

  const duplicateElement = () => {
    if (!selectedElement) return
    const src = elements.find((el) => el.id === selectedElement)
    if (!src) return
    const copy: DesignElement = {
      ...src,
      id: crypto.randomUUID(),
      x: src.x + 20,
      y: src.y + 20,
    }
    setElements((prev) => [...prev, copy])
    setSelectedElement(copy.id)
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
      setSelectedElement(el.id)
    }
    reader.readAsDataURL(file)
  }

  const loadTemplate = (templateId: string) => {
    const tpl =
      templates.find((t) => t.id === templateId) ??
      builtInTemplates.find((t) => t.id === templateId)
    if (tpl) {
      setElements(tpl.elements)
      setSelectedElement(null)
      setShowTemplates(false)
    }
  }

  // ───── Mouse interaction on canvas ─────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom

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
      setSelectedElement(clicked.id)
      setIsDragging(true)
      setDragOffset({ x: x - clicked.x, y: y - clicked.y })
    } else {
      setSelectedElement(null)
      setIsDragging(false)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedElement) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom
    const el = elements.find((e) => e.id === selectedElement)
    const newX = Math.max(0, Math.min(width - (el?.width || 0), x - dragOffset.x))
    const newY = Math.max(0, Math.min(height - (el?.height || 0), y - dragOffset.y))
    updateElement({ x: newX, y: newY })
  }

  const handleMouseUp = () => setIsDragging(false)

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

      if (el.type === "text") {
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
        ctx.fillText(el.content || "", textX, el.y + (el.fontSize || 16))
      } else if (el.type === "shape") {
        ctx.fillStyle = el.backgroundColor || "#cccccc"
        if (el.shapeType === "circle") {
          ctx.beginPath()
          ctx.ellipse(
            el.x + el.width / 2,
            el.y + el.height / 2,
            el.width / 2,
            el.height / 2,
            0,
            0,
            Math.PI * 2
          )
          ctx.fill()
        } else {
          ctx.fillRect(el.x, el.y, el.width, el.height)
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
            disabled={!selectedElement}
            className="rounded-lg border border-border p-2 transition-all hover:bg-muted disabled:opacity-30"
            title="Duplikovať"
          >
            <Copy className="h-5 w-5" />
          </button>
          <button
            onClick={deleteElement}
            disabled={!selectedElement}
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
            variant="outline"
            size="sm"
            onClick={() => onSave?.(elements)}
          >
            <Save className="mr-1.5 h-4 w-4" />
            Uložiť dizajn
          </Button>
          <Button size="sm" onClick={handleDownloadPdf}>
            <Download className="mr-1.5 h-4 w-4" />
            Stiahnuť PDF
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Properties */}
        {selectedElement && selectedData && (
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
                  <label className="mb-1 block text-sm font-medium">Farba</label>
                  <input
                    type="color"
                    value={selectedData.color || "#000000"}
                    onChange={(e) => updateElement({ color: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-md border border-border"
                  />
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
              <div>
                <label className="mb-1 block text-sm font-medium">Farba pozadia</label>
                <input
                  type="color"
                  value={selectedData.backgroundColor || "#cccccc"}
                  onChange={(e) => updateElement({ backgroundColor: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded-md border border-border"
                />
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
                isDragging ? "cursor-grabbing" : "cursor-crosshair"
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
              {[...elements].reverse().map((el) => (
                <button
                  key={el.id}
                  onClick={() => setSelectedElement(el.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-all hover:bg-muted",
                    selectedElement === el.id && "border-primary ring-1 ring-primary"
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
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedElement(el.id)
                      updateElement({ visible: !el.visible })
                    }}
                  >
                    {el.visible !== false ? (
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                </button>
              ))}
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
