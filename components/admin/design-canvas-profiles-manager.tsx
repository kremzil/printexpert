"use client"

import { useMemo, useState, useTransition } from "react"
import { AlertTriangle, Layers, Plus, Star, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCsrfHeader } from "@/lib/csrf"

type Template = {
  id: string
  productId: string
  canvasProfileId: string
  name: string
  elements: unknown
  thumbnailUrl: string | null
  isDefault: boolean
  sortOrder: number
}

type CanvasProfile = {
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
  templates: Template[]
}

type SizeOption = {
  aid: string
  termId: string
  label: string
}

type SvgImportResult = {
  elements: unknown[]
  imported: number
  skipped: number
  fallbackUsed: boolean
}

type DraftProfile = Omit<CanvasProfile, "productId" | "templates"> & {
  templates: Template[]
}

type DesignCanvasProfilesManagerProps = {
  productId: string
  profiles: CanvasProfile[]
  sizeOptions: SizeOption[]
}

const MAX_SVG_BYTES = 5 * 1024 * 1024

const defaultDraftValues = {
  trimWidthMm: 90,
  trimHeightMm: 50,
  dpi: 300,
  bgColor: "#ffffff",
  colorProfile: "CMYK",
  bleedTopMm: 0,
  bleedRightMm: 0,
  bleedBottomMm: 0,
  bleedLeftMm: 0,
  safeTopMm: 0,
  safeRightMm: 0,
  safeBottomMm: 0,
  safeLeftMm: 0,
}

const sanitizeSvg = (input: string) =>
  input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")

const parseLength = (value: string | null | undefined, fallback = 0) => {
  if (!value) return fallback
  const parsed = Number.parseFloat(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseColor = (value: string | null | undefined, fallback: string) => {
  if (!value) return fallback
  const normalized = value.trim()
  if (!normalized || normalized === "none") return fallback
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) return normalized
  return fallback
}

const mmToPx = (mm: number, dpi: number) => (mm * dpi) / 25.4

const profileCanvasPixelSize = (profile: DraftProfile) => {
  const fullWidthMm = profile.trimWidthMm + profile.bleedLeftMm + profile.bleedRightMm
  const fullHeightMm = profile.trimHeightMm + profile.bleedTopMm + profile.bleedBottomMm
  return {
    width: Math.max(1, Math.round(mmToPx(fullWidthMm, profile.dpi))),
    height: Math.max(1, Math.round(mmToPx(fullHeightMm, profile.dpi))),
  }
}

const buildSvgFallbackImage = (svg: string, profile: DraftProfile): unknown => {
  const encoded = encodeURIComponent(svg)
  const { width, height } = profileCanvasPixelSize(profile)
  return {
    id: crypto.randomUUID(),
    type: "image",
    x: 0,
    y: 0,
    width,
    height,
    imageUrl: `data:image/svg+xml;charset=utf-8,${encoded}`,
    visible: true,
    locked: true,
  }
}

const parseSvgToElements = (svgText: string, profile: DraftProfile): SvgImportResult => {
  const cleanedSvg = sanitizeSvg(svgText)
  const doc = new DOMParser().parseFromString(cleanedSvg, "image/svg+xml")
  const svg = doc.querySelector("svg")
  if (!svg) {
    return {
      elements: [buildSvgFallbackImage(cleanedSvg, profile)],
      imported: 0,
      skipped: 1,
      fallbackUsed: true,
    }
  }

  const { width: targetWidth, height: targetHeight } = profileCanvasPixelSize(profile)
  const viewBox = svg.getAttribute("viewBox")
  const fallbackWidth = parseLength(svg.getAttribute("width"), targetWidth)
  const fallbackHeight = parseLength(svg.getAttribute("height"), targetHeight)
  const [vbX, vbY, vbWidth, vbHeight] = viewBox
    ? viewBox.split(/[\s,]+/).map((item) => Number.parseFloat(item))
    : [0, 0, fallbackWidth, fallbackHeight]

  const sourceWidth = Number.isFinite(vbWidth) && vbWidth > 0 ? vbWidth : fallbackWidth
  const sourceHeight = Number.isFinite(vbHeight) && vbHeight > 0 ? vbHeight : fallbackHeight
  const sourceX = Number.isFinite(vbX) ? vbX : 0
  const sourceY = Number.isFinite(vbY) ? vbY : 0

  const scaleX = targetWidth / Math.max(sourceWidth, 1)
  const scaleY = targetHeight / Math.max(sourceHeight, 1)

  const nodes = Array.from(svg.querySelectorAll("*"))
  const elements: unknown[] = []
  let skipped = 0

  for (const node of nodes) {
    const tag = node.tagName.toLowerCase()

    if (tag === "rect") {
      const x = (parseLength(node.getAttribute("x")) - sourceX) * scaleX
      const y = (parseLength(node.getAttribute("y")) - sourceY) * scaleY
      const width = parseLength(node.getAttribute("width")) * scaleX
      const height = parseLength(node.getAttribute("height")) * scaleY
      if (width <= 0 || height <= 0) {
        skipped += 1
        continue
      }
      elements.push({
        id: crypto.randomUUID(),
        type: "shape",
        shapeType: "rectangle",
        x,
        y,
        width,
        height,
        borderRadius: parseLength(node.getAttribute("rx")) * ((scaleX + scaleY) / 2),
        backgroundColor: parseColor(node.getAttribute("fill"), "#cccccc"),
        visible: true,
      })
      continue
    }

    if (tag === "circle") {
      const cx = (parseLength(node.getAttribute("cx")) - sourceX) * scaleX
      const cy = (parseLength(node.getAttribute("cy")) - sourceY) * scaleY
      const r = parseLength(node.getAttribute("r"))
      const width = r * 2 * scaleX
      const height = r * 2 * scaleY
      elements.push({
        id: crypto.randomUUID(),
        type: "shape",
        shapeType: "circle",
        x: cx - width / 2,
        y: cy - height / 2,
        width,
        height,
        backgroundColor: parseColor(node.getAttribute("fill"), "#cccccc"),
        visible: true,
      })
      continue
    }

    if (tag === "ellipse") {
      const cx = (parseLength(node.getAttribute("cx")) - sourceX) * scaleX
      const cy = (parseLength(node.getAttribute("cy")) - sourceY) * scaleY
      const rx = parseLength(node.getAttribute("rx")) * scaleX
      const ry = parseLength(node.getAttribute("ry")) * scaleY
      elements.push({
        id: crypto.randomUUID(),
        type: "shape",
        shapeType: "circle",
        x: cx - rx,
        y: cy - ry,
        width: rx * 2,
        height: ry * 2,
        backgroundColor: parseColor(node.getAttribute("fill"), "#cccccc"),
        visible: true,
      })
      continue
    }

    if (tag === "text") {
      const textValue = node.textContent?.trim() ?? ""
      if (!textValue) {
        skipped += 1
        continue
      }
      const x = (parseLength(node.getAttribute("x")) - sourceX) * scaleX
      const y = (parseLength(node.getAttribute("y")) - sourceY) * scaleY
      const fontSize = Math.max(6, parseLength(node.getAttribute("font-size"), 16) * ((scaleX + scaleY) / 2))
      const textAlignRaw = node.getAttribute("text-anchor")
      const textAlign =
        textAlignRaw === "middle"
          ? "center"
          : textAlignRaw === "end"
            ? "right"
            : "left"
      const approxWidth = Math.max(20, Math.ceil(textValue.length * fontSize * 0.6))
      const approxHeight = Math.max(14, Math.ceil(fontSize * 1.3))

      elements.push({
        id: crypto.randomUUID(),
        type: "text",
        x,
        y,
        width: approxWidth,
        height: approxHeight,
        content: textValue,
        fontSize: Math.round(fontSize),
        fontFamily: node.getAttribute("font-family") || "Arial",
        fontWeight: node.getAttribute("font-weight") || "normal",
        fontStyle: node.getAttribute("font-style") || "normal",
        textAlign,
        color: parseColor(node.getAttribute("fill"), "#000000"),
        visible: true,
      })
      continue
    }

    if (tag === "image") {
      const href = node.getAttribute("href") || node.getAttribute("xlink:href")
      if (!href || href.trim().toLowerCase().startsWith("javascript:")) {
        skipped += 1
        continue
      }
      const x = (parseLength(node.getAttribute("x")) - sourceX) * scaleX
      const y = (parseLength(node.getAttribute("y")) - sourceY) * scaleY
      const width = parseLength(node.getAttribute("width")) * scaleX
      const height = parseLength(node.getAttribute("height")) * scaleY
      if (width <= 0 || height <= 0) {
        skipped += 1
        continue
      }
      elements.push({
        id: crypto.randomUUID(),
        type: "image",
        x,
        y,
        width,
        height,
        imageUrl: href,
        visible: true,
      })
      continue
    }
  }

  if (elements.length === 0) {
    return {
      elements: [buildSvgFallbackImage(cleanedSvg, profile)],
      imported: 0,
      skipped: Math.max(skipped, 1),
      fallbackUsed: true,
    }
  }

  return { elements, imported: elements.length, skipped, fallbackUsed: false }
}

const toDraft = (profile: CanvasProfile): DraftProfile => ({
  ...profile,
  trimWidthMm: Number(profile.trimWidthMm),
  trimHeightMm: Number(profile.trimHeightMm),
  dpi: Number(profile.dpi),
  bleedTopMm: Number(profile.bleedTopMm),
  bleedRightMm: Number(profile.bleedRightMm),
  bleedBottomMm: Number(profile.bleedBottomMm),
  bleedLeftMm: Number(profile.bleedLeftMm),
  safeTopMm: Number(profile.safeTopMm),
  safeRightMm: Number(profile.safeRightMm),
  safeBottomMm: Number(profile.safeBottomMm),
  safeLeftMm: Number(profile.safeLeftMm),
  templates: profile.templates ?? [],
})

export function DesignCanvasProfilesManager({
  productId,
  profiles: initialProfiles,
  sizeOptions,
}: DesignCanvasProfilesManagerProps) {
  const [profiles, setProfiles] = useState<DraftProfile[]>(() =>
    initialProfiles.map(toDraft)
  )
  const [isPending, startTransition] = useTransition()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [newProfileName, setNewProfileName] = useState("")
  const [newProfileSizeKey, setNewProfileSizeKey] = useState("")
  const [newTemplateNames, setNewTemplateNames] = useState<Record<string, string>>({})

  const sizeByKey = useMemo(
    () =>
      new Map(
        sizeOptions.map((option) => [
          `${option.aid}:${option.termId}`,
          option,
        ])
      ),
    [sizeOptions]
  )

  const hasSizeOptions = sizeOptions.length > 0
  const hasDuplicateSizeBinding = (
    profileId: string,
    sizeAid: string | null,
    sizeTermId: string | null
  ) =>
    Boolean(sizeAid && sizeTermId) &&
    profiles.some(
      (profile) =>
        profile.id !== profileId &&
        profile.sizeAid === sizeAid &&
        profile.sizeTermId === sizeTermId
    )

  const setProfileField = <K extends keyof DraftProfile>(
    profileId: string,
    key: K,
    value: DraftProfile[K]
  ) => {
    setProfiles((prev) =>
      prev.map((profile) =>
        profile.id === profileId ? { ...profile, [key]: value } : profile
      )
    )
  }

  const createProfile = () => {
    if (!hasSizeOptions) return
    if (!newProfileName.trim()) return
    const selectedSize = sizeByKey.get(newProfileSizeKey)
    if (!selectedSize) return
    const duplicate = profiles.some(
      (profile) =>
        profile.sizeAid === selectedSize.aid &&
        profile.sizeTermId === selectedSize.termId
    )
    if (duplicate) {
      setStatusMessage("Profil pre túto veľkosť už existuje.")
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/design-canvas-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({
          productId,
          name: newProfileName.trim(),
          sizeAid: selectedSize.aid,
          sizeTermId: selectedSize.termId,
          sizeLabel: selectedSize.label,
          ...defaultDraftValues,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setStatusMessage(
          payload?.error || "Nepodarilo sa vytvoriť profil plátna."
        )
        return
      }
      const created = (await response.json()) as CanvasProfile
      setProfiles((prev) => [...prev, toDraft({ ...created, templates: [] })])
      setNewProfileName("")
      setNewProfileSizeKey("")
      setStatusMessage("Profil plátna bol vytvorený.")
    })
  }

  const saveProfile = (profile: DraftProfile) => {
    if (hasDuplicateSizeBinding(profile.id, profile.sizeAid, profile.sizeTermId)) {
      setStatusMessage("Profil pre túto veľkosť už existuje.")
      return
    }

    startTransition(async () => {
      const response = await fetch(`/api/design-canvas-profiles/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({
          name: profile.name,
          sizeAid: profile.sizeAid,
          sizeTermId: profile.sizeTermId,
          sizeLabel: profile.sizeLabel,
          trimWidthMm: profile.trimWidthMm,
          trimHeightMm: profile.trimHeightMm,
          dpi: profile.dpi,
          bgColor: profile.bgColor,
          colorProfile: profile.colorProfile,
          bleedTopMm: profile.bleedTopMm,
          bleedRightMm: profile.bleedRightMm,
          bleedBottomMm: profile.bleedBottomMm,
          bleedLeftMm: profile.bleedLeftMm,
          safeTopMm: profile.safeTopMm,
          safeRightMm: profile.safeRightMm,
          safeBottomMm: profile.safeBottomMm,
          safeLeftMm: profile.safeLeftMm,
          isActive: profile.isActive,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setStatusMessage(payload?.error || "Nepodarilo sa uložiť profil.")
        return
      }
      const updated = (await response.json()) as CanvasProfile
      setProfiles((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...toDraft({ ...updated, templates: item.templates }) } : item
        )
      )
      setStatusMessage("Profil bol uložený.")
    })
  }

  const deleteProfile = (profileId: string) => {
    startTransition(async () => {
      const response = await fetch(`/api/design-canvas-profiles/${profileId}`, {
        method: "DELETE",
        headers: { ...getCsrfHeader() },
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setStatusMessage(payload?.error || "Nepodarilo sa odstrániť profil.")
        return
      }
      setProfiles((prev) => prev.filter((item) => item.id !== profileId))
      setStatusMessage("Profil bol odstránený.")
    })
  }

  const createEmptyTemplate = (profile: DraftProfile) => {
    const value = (newTemplateNames[profile.id] ?? "").trim()
    if (!value) return

    startTransition(async () => {
      const response = await fetch("/api/design-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({
          productId,
          canvasProfileId: profile.id,
          name: value,
          elements: [],
          isDefault: profile.templates.length === 0,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setStatusMessage(payload?.error || "Nepodarilo sa vytvoriť šablónu.")
        return
      }
      const created = (await response.json()) as Template
      setProfiles((prev) =>
        prev.map((item) =>
          item.id === profile.id
            ? { ...item, templates: [...item.templates, created] }
            : item
        )
      )
      setNewTemplateNames((prev) => ({ ...prev, [profile.id]: "" }))
      setStatusMessage("Prázdna šablóna bola vytvorená.")
    })
  }

  const setTemplateDefault = (profileId: string, templateId: string) => {
    startTransition(async () => {
      const response = await fetch(`/api/design-templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({ isDefault: true }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setStatusMessage(payload?.error || "Nepodarilo sa nastaviť predvolenú šablónu.")
        return
      }
      setProfiles((prev) =>
        prev.map((profile) =>
          profile.id === profileId
            ? {
                ...profile,
                templates: profile.templates.map((template) => ({
                  ...template,
                  isDefault: template.id === templateId,
                })),
              }
            : profile
        )
      )
      setStatusMessage("Predvolená šablóna bola uložená.")
    })
  }

  const deleteTemplate = (profileId: string, templateId: string) => {
    startTransition(async () => {
      const response = await fetch(`/api/design-templates/${templateId}`, {
        method: "DELETE",
        headers: { ...getCsrfHeader() },
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setStatusMessage(payload?.error || "Nepodarilo sa odstrániť šablónu.")
        return
      }
      setProfiles((prev) =>
        prev.map((profile) =>
          profile.id === profileId
            ? {
                ...profile,
                templates: profile.templates.filter((template) => template.id !== templateId),
              }
            : profile
        )
      )
      setStatusMessage("Šablóna bola odstránená.")
    })
  }

  const importSvgTemplate = async (profile: DraftProfile, file: File) => {
    if (!file.name.toLowerCase().endsWith(".svg")) {
      setStatusMessage("Podporovaný je iba SVG súbor.")
      return
    }
    if (file.size > MAX_SVG_BYTES) {
      setStatusMessage("SVG súbor je príliš veľký (max. 5 MB).")
      return
    }
    const rawText = await file.text()
    const parsed = parseSvgToElements(rawText, profile)
    const templateName = file.name.replace(/\.svg$/i, "").trim() || "SVG šablóna"

    startTransition(async () => {
      const response = await fetch("/api/design-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({
          productId,
          canvasProfileId: profile.id,
          name: templateName,
          elements: parsed.elements,
          isDefault: profile.templates.length === 0,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setStatusMessage(payload?.error || "Nepodarilo sa importovať SVG šablónu.")
        return
      }
      const created = (await response.json()) as Template
      setProfiles((prev) =>
        prev.map((item) =>
          item.id === profile.id
            ? { ...item, templates: [...item.templates, created] }
            : item
        )
      )

      const fallbackNote = parsed.fallbackUsed ? " (použitý fallback obrázok)" : ""
      setStatusMessage(
        `SVG import: ${parsed.imported} elementov, preskočené ${parsed.skipped}${fallbackNote}.`
      )
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-purple-600" />
        <h3 className="text-base font-semibold">Profily plátna a šablóny</h3>
      </div>

      {!hasSizeOptions && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <p>
              Atribút <strong>Veľkosť</strong> nebol nájdený v základnej matici.
              Profily pre vitrinový dizajnér sú vypnuté, kým nebude dostupný size-select.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-md border p-4">
        <div className="grid gap-3 md:grid-cols-[2fr_2fr_auto] md:items-end">
          <div className="space-y-1">
            <Label htmlFor="newProfileName">Názov profilu</Label>
            <Input
              id="newProfileName"
              value={newProfileName}
              onChange={(event) => setNewProfileName(event.target.value)}
              placeholder="Napr. Vizitka 90x50"
              disabled={!hasSizeOptions}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="newProfileSize">Veľkosť</Label>
            <select
              id="newProfileSize"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={newProfileSizeKey}
              onChange={(event) => setNewProfileSizeKey(event.target.value)}
              disabled={!hasSizeOptions}
            >
              <option value="">Vyberte veľkosť</option>
              {sizeOptions.map((option) => (
                <option
                  key={`${option.aid}:${option.termId}`}
                  value={`${option.aid}:${option.termId}`}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={createProfile}
            disabled={isPending || !hasSizeOptions || !newProfileName.trim() || !newProfileSizeKey}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Pridať profil
          </Button>
        </div>
      </div>

      {statusMessage && (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      )}

      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Zatiaľ nebol vytvorený žiadny profil plátna.
        </p>
      ) : (
        <div className="space-y-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="space-y-4 rounded-md border p-4">
              <div className="grid gap-3 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label>Názov profilu</Label>
                  <Input
                    value={profile.name}
                    onChange={(event) => setProfileField(profile.id, "name", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Veľkosť</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={profile.sizeAid && profile.sizeTermId ? `${profile.sizeAid}:${profile.sizeTermId}` : ""}
                    onChange={(event) => {
                      const selected = sizeByKey.get(event.target.value)
                      if (!selected) return
                      if (
                        hasDuplicateSizeBinding(
                          profile.id,
                          selected.aid,
                          selected.termId
                        )
                      ) {
                        setStatusMessage("Profil pre túto veľkosť už existuje.")
                        return
                      }
                      setProfileField(profile.id, "sizeAid", selected.aid)
                      setProfileField(profile.id, "sizeTermId", selected.termId)
                      setProfileField(profile.id, "sizeLabel", selected.label)
                    }}
                    disabled={!hasSizeOptions}
                  >
                    <option value="">Bez mapovania</option>
                    {sizeOptions.map((option) => (
                      <option
                        key={`${option.aid}:${option.termId}`}
                        value={`${option.aid}:${option.termId}`}
                        disabled={profiles.some(
                          (item) =>
                            item.id !== profile.id &&
                            item.sizeAid === option.aid &&
                            item.sizeTermId === option.termId
                        )}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Trim šírka (mm)</Label>
                  <Input
                    type="number"
                    min={1}
                    step={0.1}
                    value={profile.trimWidthMm}
                    onChange={(event) =>
                      setProfileField(profile.id, "trimWidthMm", Number(event.target.value))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Trim výška (mm)</Label>
                  <Input
                    type="number"
                    min={1}
                    step={0.1}
                    value={profile.trimHeightMm}
                    onChange={(event) =>
                      setProfileField(profile.id, "trimHeightMm", Number(event.target.value))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label>DPI</Label>
                  <Input
                    type="number"
                    min={72}
                    max={1200}
                    value={profile.dpi}
                    onChange={(event) =>
                      setProfileField(profile.id, "dpi", Number(event.target.value))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Farba pozadia</Label>
                  <Input
                    type="color"
                    value={profile.bgColor}
                    onChange={(event) =>
                      setProfileField(profile.id, "bgColor", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Farebný profil</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={profile.colorProfile}
                    onChange={(event) =>
                      setProfileField(profile.id, "colorProfile", event.target.value)
                    }
                  >
                    <option value="CMYK">CMYK</option>
                    <option value="RGB">RGB</option>
                    <option value="sRGB">sRGB</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6 text-sm">
                  <input
                    id={`active-${profile.id}`}
                    type="checkbox"
                    checked={profile.isActive}
                    onChange={(event) =>
                      setProfileField(profile.id, "isActive", event.target.checked)
                    }
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <Label htmlFor={`active-${profile.id}`}>Aktívny profil</Label>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Bleed (mm)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" step={0.1} value={profile.bleedTopMm} onChange={(event) => setProfileField(profile.id, "bleedTopMm", Number(event.target.value))} placeholder="Top" />
                    <Input type="number" step={0.1} value={profile.bleedRightMm} onChange={(event) => setProfileField(profile.id, "bleedRightMm", Number(event.target.value))} placeholder="Right" />
                    <Input type="number" step={0.1} value={profile.bleedBottomMm} onChange={(event) => setProfileField(profile.id, "bleedBottomMm", Number(event.target.value))} placeholder="Bottom" />
                    <Input type="number" step={0.1} value={profile.bleedLeftMm} onChange={(event) => setProfileField(profile.id, "bleedLeftMm", Number(event.target.value))} placeholder="Left" />
                  </div>
                </div>
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Safe zóna (mm)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" step={0.1} value={profile.safeTopMm} onChange={(event) => setProfileField(profile.id, "safeTopMm", Number(event.target.value))} placeholder="Top" />
                    <Input type="number" step={0.1} value={profile.safeRightMm} onChange={(event) => setProfileField(profile.id, "safeRightMm", Number(event.target.value))} placeholder="Right" />
                    <Input type="number" step={0.1} value={profile.safeBottomMm} onChange={(event) => setProfileField(profile.id, "safeBottomMm", Number(event.target.value))} placeholder="Bottom" />
                    <Input type="number" step={0.1} value={profile.safeLeftMm} onChange={(event) => setProfileField(profile.id, "safeLeftMm", Number(event.target.value))} placeholder="Left" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => saveProfile(profile)}
                  disabled={isPending}
                >
                  Uložiť profil
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteProfile(profile.id)}
                  disabled={isPending}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Odstrániť profil
                </Button>
              </div>

              <div className="space-y-3 rounded-md border border-dashed p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Šablóny ({profile.templates.length})
                  </p>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                    <Upload className="h-4 w-4" />
                    Import SVG
                    <input
                      type="file"
                      accept=".svg,image/svg+xml"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) {
                          void importSvgTemplate(profile, file)
                        }
                        event.target.value = ""
                      }}
                      disabled={isPending}
                    />
                  </label>
                </div>

                {profile.templates.length > 0 && (
                  <div className="space-y-2">
                    {profile.templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between gap-3 rounded-md border p-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{template.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {Array.isArray(template.elements)
                              ? `${template.elements.length} elementov`
                              : "Šablóna"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!template.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setTemplateDefault(profile.id, template.id)}
                              disabled={isPending}
                              title="Nastaviť ako predvolenú"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTemplate(profile.id, template.id)}
                            disabled={isPending}
                            title="Odstrániť šablónu"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`new-template-${profile.id}`}>Nová prázdna šablóna</Label>
                    <Input
                      id={`new-template-${profile.id}`}
                      value={newTemplateNames[profile.id] ?? ""}
                      onChange={(event) =>
                        setNewTemplateNames((prev) => ({
                          ...prev,
                          [profile.id]: event.target.value,
                        }))
                      }
                      placeholder="Názov šablóny..."
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => createEmptyTemplate(profile)}
                    disabled={isPending || !(newTemplateNames[profile.id] ?? "").trim()}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Pridať
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
