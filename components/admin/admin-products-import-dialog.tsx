"use client"

import { useMemo, useState } from "react"
import { Plus, Upload, X } from "lucide-react"

import { AdminButton } from "@/components/admin/admin-button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

const PRODUCT_FIELD_OPTIONS = [
  { value: "slug", label: "Slug" },
  { value: "name", label: "Názov" },
  { value: "categorySlug", label: "Kategória (slug)" },
  { value: "wpProductId", label: "WP Product ID" },
  { value: "excerpt", label: "Krátky popis" },
  { value: "description", label: "Popis" },
  { value: "priceFrom", label: "Cena od" },
  { value: "vatRate", label: "Sadzba DPH" },
  { value: "priceType", label: "Typ ceny" },
  { value: "isActive", label: "Aktívny" },
  { value: "showInB2b", label: "Zobraziť v B2B" },
  { value: "showInB2c", label: "Zobraziť v B2C" },
  { value: "imageUrl", label: "Hlavný obrázok (URL)" },
]

type MappingRow = {
  id: string
  csvColumn: string
  field: string
}

const DEFAULT_ROWS: MappingRow[] = [
  { id: "row-1", csvColumn: "", field: "slug" },
  { id: "row-2", csvColumn: "", field: "name" },
  { id: "row-3", csvColumn: "", field: "categorySlug" },
  { id: "row-4", csvColumn: "", field: "wpProductId" },
  { id: "row-5", csvColumn: "", field: "priceFrom" },
]

export function AdminProductsImportDialog() {
  const { toast } = useToast()
  const [rows, setRows] = useState<MappingRow[]>(DEFAULT_ROWS)
  const [matchKey, setMatchKey] = useState("slug")
  const [mode, setMode] = useState("upsert")
  const [defaults, setDefaults] = useState("")
  const [skipUnchanged, setSkipUnchanged] = useState(true)
  const [dryRun, setDryRun] = useState(true)
  const [createImages, setCreateImages] = useState(false)
  const [imageStrategy, setImageStrategy] = useState("original")
  const [imageWidth, setImageWidth] = useState("1200")
  const [imageQuality, setImageQuality] = useState("80")
  const [imageFolder, setImageFolder] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [result, setResult] = useState<
    | {
        created: number
        updated: number
        skipped: number
        failed: number
        errors: string[]
      }
    | null
  >(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fieldOptions = useMemo(() => PRODUCT_FIELD_OPTIONS, [])

  function parseCsvHeaders(text: string) {
    const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0)
    if (!firstLine) return []
    const delimiter = firstLine.includes(";") ? ";" : ","
    const headers = firstLine
      .split(delimiter)
      .map((value) => value.replace(/^\uFEFF/, "").trim())
      .filter(Boolean)
    return Array.from(new Set(headers))
  }

  async function handleFileChange(fileValue: File | null) {
    setFile(fileValue)
    setCsvHeaders([])
    if (!fileValue) return
    const text = await fileValue.text()
    const headers = parseCsvHeaders(text)
    setCsvHeaders(headers)
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: `row-${prev.length + 1}`, csvColumn: "", field: "slug" },
    ])
  }

  function updateRow(id: string, patch: Partial<MappingRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id))
  }

  async function handleSubmit() {
    if (!file) {
      toast({
        title: "Chýba CSV súbor",
        description: "Vyberte CSV súbor, ktorý chcete importovať.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.set("file", file)
      formData.set("matchKey", matchKey)
      formData.set("mode", mode)
      formData.set("mapping", JSON.stringify(rows))
      formData.set("defaults", defaults)
      formData.set("dryRun", String(dryRun))
      formData.set("skipUnchanged", String(skipUnchanged))
      formData.set("createImages", String(createImages))
      formData.set("imageStrategy", imageStrategy)
      formData.set("imageWidth", imageWidth)
      formData.set("imageQuality", imageQuality)
      formData.set("imageFolder", imageFolder)

      const response = await fetch("/api/admin/products/import", {
        method: "POST",
        body: formData,
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Import zlyhal.")
      }

      setResult(payload)
      toast({
        title: dryRun ? "Kontrola dokončená" : "Import dokončený",
        description: `Vytvorené: ${payload.created}, aktualizované: ${payload.updated}, preskočené: ${payload.skipped}, chyby: ${payload.failed}.`,
      })
    } catch (error) {
      toast({
        title: "Import zlyhal",
        description: error instanceof Error ? error.message : "Skúste to znova.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <AdminButton variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importovať CSV
        </AdminButton>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] w-full max-w-[85vw] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Import produktov z CSV</DialogTitle>
          <DialogDescription>
            Nastavte kľúč porovnania, mapovanie stĺpcov a spustite idempotentný import.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="space-y-6 pb-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV súbor</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Podporované oddelovače: čiarka, bodkočiarka. UTF-8 bez BOM.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-name">Názov profilu</Label>
              <Input id="profile-name" placeholder="Napr. WooCommerce export" />
              <p className="text-xs text-muted-foreground">
                Profil umožní opakovaný import s rovnakými pravidlami.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Porovnať podľa</Label>
              <Select value={matchKey} onValueChange={setMatchKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte stĺpec" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slug">Slug</SelectItem>
                  <SelectItem value="wpProductId">WP Product ID</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Použije sa na nájdenie existujúceho produktu a bezpečný upsert.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Režim importu</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte režim" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upsert">Vytvoriť alebo aktualizovať</SelectItem>
                  <SelectItem value="update">Iba aktualizovať existujúce</SelectItem>
                  <SelectItem value="create">Iba vytvárať nové</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vyberte, či chcete importom vytvárať aj nové produkty.
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Mapovanie stĺpcov</h3>
                <p className="text-xs text-muted-foreground">
                  Zadajte názov stĺpca z CSV a vyberte pole produktu, ktoré sa má aktualizovať.
                </p>
              </div>
              <AdminButton type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="mr-2 h-4 w-4" />
                Pridať riadok
              </AdminButton>
            </div>

            <div className="mt-4 space-y-3">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid items-center gap-3 rounded-md border bg-muted/40 p-3 md:grid-cols-[1.2fr_1fr_auto]"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">CSV stĺpec</Label>
                    {csvHeaders.length > 0 ? (
                      <Select
                        value={row.csvColumn}
                        onValueChange={(value) => updateRow(row.id, { csvColumn: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Vyberte stĺpec" />
                        </SelectTrigger>
                        <SelectContent>
                          {csvHeaders.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={row.csvColumn}
                        onChange={(event) => updateRow(row.id, { csvColumn: event.target.value })}
                        placeholder="Napr. post_title"
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pole produktu</Label>
                    <Select
                      value={row.field}
                      onValueChange={(value) => updateRow(row.id, { field: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte pole" />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <AdminButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-muted-foreground"
                    onClick={() => removeRow(row.id)}
                    aria-label="Odstrániť riadok"
                  >
                    <X className="h-4 w-4" />
                  </AdminButton>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defaults">Predvolené hodnoty</Label>
              <Textarea
                id="defaults"
                placeholder="Napr. showInB2c=true, isActive=true"
                className="min-h-[90px]"
                value={defaults}
                onChange={(event) => setDefaults(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Hodnoty, ktoré sa doplnia, keď CSV nemá konkrétny stĺpec.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skip-unchanged"
                  checked={skipUnchanged}
                  onCheckedChange={(value) => setSkipUnchanged(Boolean(value))}
                />
                <Label htmlFor="skip-unchanged">Preskočiť nezmenené záznamy</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dry-run"
                  checked={dryRun}
                  onCheckedChange={(value) => setDryRun(Boolean(value))}
                />
                <Label htmlFor="dry-run">Najskôr len kontrola (dry-run)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="create-images"
                  checked={createImages}
                  onCheckedChange={(value) => setCreateImages(Boolean(value))}
                />
                <Label htmlFor="create-images">Vytvárať obrázky v galérii</Label>
              </div>
              <div className="space-y-2">
                <Label>Práca s obrázkami</Label>
                <Select value={imageStrategy} onValueChange={setImageStrategy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte spôsob" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">Použiť pôvodné URL</SelectItem>
                    <SelectItem value="download">Stiahnuť a uložiť u nás</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Pri uložení sa automaticky vytvorí priečinok s ID produktu.
                </p>
                <p className="text-xs text-muted-foreground">
                  Viac URL oddeľte čiarkou. Prvá bude hlavná, ostatné v karuseli.
                </p>
              </div>
              {imageStrategy === "download" && (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="image-width" className="text-xs">
                      Šírka (px)
                    </Label>
                    <Input
                      id="image-width"
                      type="number"
                      min={200}
                      value={imageWidth}
                      onChange={(event) => setImageWidth(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="image-quality" className="text-xs">
                      Kvalita (1–100)
                    </Label>
                    <Input
                      id="image-quality"
                      type="number"
                      min={40}
                      max={100}
                      value={imageQuality}
                      onChange={(event) => setImageQuality(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="image-folder" className="text-xs">
                      Priečinok v /public/products
                    </Label>
                    <Input
                      id="image-folder"
                      placeholder="napr. imports"
                      value={imageFolder}
                      onChange={(event) => setImageFolder(event.target.value)}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Výstup kontroly zobrazí počet vytvorených, aktualizovaných a preskočených položiek.
              </p>
            </div>
          </div>

            {result && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="grid gap-2 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Vytvorené</p>
                    <p className="text-lg font-semibold">{result.created}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Aktualizované</p>
                    <p className="text-lg font-semibold">{result.updated}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Preskočené</p>
                    <p className="text-lg font-semibold">{result.skipped}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Chyby</p>
                    <p className="text-lg font-semibold">{result.failed}</p>
                  </div>
                </div>
                {result.errors?.length ? (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {result.errors.slice(0, 5).map((error, index) => (
                      <p key={`${index}-${error}`}>• {error}</p>
                    ))}
                    {result.errors.length > 5 && (
                      <p>… ďalších {result.errors.length - 5} chýb</p>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <AdminButton variant="secondary" disabled>
            Uložiť profil (čoskoro)
          </AdminButton>
          <AdminButton onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Spracúvam…" : dryRun ? "Spustiť kontrolu" : "Spustiť import"}
          </AdminButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
