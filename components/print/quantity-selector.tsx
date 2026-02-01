"use client"

import { Minus, Plus } from "lucide-react"

import type { CustomerMode } from "@/components/print/types"

interface QuantitySelectorProps {
  mode: CustomerMode
  value: number
  onChange: (value: number) => void
  presets?: number[]
  usePresetsSelect?: boolean
  min?: number
}

export function QuantitySelector({
  mode,
  value,
  onChange,
  presets = [100, 250, 500, 1000, 2500],
  usePresetsSelect = false,
  min,
}: QuantitySelectorProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"
  const minValue = min ?? presets[0] ?? 1

  const handleIncrement = () => {
    onChange(value + 1)
  }

  const handleDecrement = () => {
    if (value > minValue) {
      onChange(value - 1)
    }
  }

  return (
    <div className="space-y-3">
      <label className="font-medium">Množstvo kusov</label>

      {usePresetsSelect ? (
        <div className="grid grid-cols-5 gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => onChange(preset)}
              className={`
                rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all
                ${value === preset ? "shadow-sm" : "hover:border-muted-foreground"}
              `}
              style={{
                borderColor: value === preset ? modeColor : "var(--border)",
                backgroundColor: value === preset ? modeAccent : "transparent",
                color: value === preset ? modeColor : undefined,
              }}
            >
              {preset}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleDecrement}
            disabled={value <= minValue}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Znížiť množstvo"
          >
            <Minus className="h-4 w-4" />
          </button>

          <div className="flex-1">
            <input
              type="number"
              value={value}
              onChange={(e) => {
                const newValue = parseInt(e.target.value, 10)
                if (Number.isNaN(newValue)) {
                  onChange(minValue)
                  return
                }
                onChange(Math.max(minValue, newValue))
              }}
              min={minValue}
              step={1}
              className="w-full rounded-lg border border-border bg-input-background px-4 py-2 text-center font-medium focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": modeColor } as React.CSSProperties}
            />
          </div>

          <button
            onClick={handleIncrement}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background transition-all hover:bg-muted"
            aria-label="Zvýšiť množstvo"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Minimálne množstvo: {minValue} ks. Pri vyšších množstvách dostanete
        automatickú zľavu.
      </p>
    </div>
  )
}
