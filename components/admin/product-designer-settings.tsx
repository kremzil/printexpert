"use client"

import { useState } from "react"
import { Paintbrush, Settings } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface ProductDesignerSettingsProps {
  designerEnabled: boolean
  designerWidth: number | null
  designerHeight: number | null
  designerBgColor: string | null
  designerDpi: number | null
  designerColorProfile: string | null
}

export function ProductDesignerSettings({
  designerEnabled,
  designerWidth,
  designerHeight,
  designerBgColor,
  designerDpi,
  designerColorProfile,
}: ProductDesignerSettingsProps) {
  const [enabled, setEnabled] = useState(designerEnabled)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Paintbrush className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">Design Studio</h3>
      </div>

      <div className="flex flex-wrap gap-4 rounded-md border bg-card p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="designerEnabled"
            value="1"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <span className="font-medium">Povoliť dizajnér pre tento produkt</span>
          <input type="hidden" name="designerEnabled" value="0" />
        </label>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-md border border-dashed p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Settings className="h-4 w-4" />
            <span className="font-medium">Nastavenia plátna dizajnéra</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="designerWidth">Šírka plátna (px)</Label>
              <Input
                id="designerWidth"
                name="designerWidth"
                type="number"
                min={100}
                max={5000}
                defaultValue={designerWidth ?? 1050}
                placeholder="1050"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designerHeight">Výška plátna (px)</Label>
              <Input
                id="designerHeight"
                name="designerHeight"
                type="number"
                min={100}
                max={5000}
                defaultValue={designerHeight ?? 600}
                placeholder="600"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="designerBgColor">Farba pozadia</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="designerBgColor"
                  name="designerBgColor"
                  defaultValue={designerBgColor ?? "#ffffff"}
                  className="h-9 w-12 cursor-pointer rounded-md border border-input"
                />
                <Input
                  name="designerBgColorText"
                  defaultValue={designerBgColor ?? "#ffffff"}
                  placeholder="#ffffff"
                  className="flex-1"
                  readOnly
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="designerDpi">DPI</Label>
              <Input
                id="designerDpi"
                name="designerDpi"
                type="number"
                min={72}
                max={1200}
                defaultValue={designerDpi ?? 300}
                placeholder="300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designerColorProfile">Farebný profil</Label>
              <select
                id="designerColorProfile"
                name="designerColorProfile"
                defaultValue={designerColorProfile ?? "CMYK"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="CMYK">CMYK</option>
                <option value="RGB">RGB</option>
                <option value="sRGB">sRGB</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
