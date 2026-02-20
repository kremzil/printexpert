"use client"

import { useState } from "react"
import { Paintbrush } from "lucide-react"

interface ProductDesignerSettingsProps {
  designerEnabled: boolean
}

export function ProductDesignerSettings({
  designerEnabled,
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
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Mapovanie plátna podľa hodnoty <strong>Veľkosť</strong>, bleed/safe zóny
          a správa SVG šablón sa nastavujú nižšie v sekcii profilov.
        </div>
      )}
    </div>
  )
}
