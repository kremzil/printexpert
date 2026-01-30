"use client"

import { Check, Info } from "lucide-react"

import type { CustomerMode } from "@/components/print/types"

interface ConfiguratorOptionProps {
  mode: CustomerMode
  label: string
  options: {
    id: string
    label: string
    description?: string
    price?: number
    recommended?: boolean
  }[]
  selected?: string
  onSelect?: (id: string) => void
  helpText?: string
}

export function ConfiguratorOption({
  mode,
  label,
  options,
  selected,
  onSelect,
  helpText,
}: ConfiguratorOptionProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="font-medium">{label}</label>
        {helpText && (
          <div className="group relative">
            <Info className="h-4 w-4 cursor-help text-muted-foreground" />
            <div className="invisible absolute right-0 top-6 z-10 w-64 rounded-lg border border-border bg-popover p-3 text-sm shadow-lg group-hover:visible">
              {helpText}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {options.map((option) => {
          const isSelected = selected === option.id

          return (
            <button
              key={option.id}
              onClick={() => onSelect?.(option.id)}
              className={`
                relative flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all
                ${isSelected ? "shadow-sm" : "border-border hover:border-muted-foreground"}
              `}
              style={{
                borderColor: isSelected ? modeColor : undefined,
                backgroundColor: isSelected ? modeAccent : undefined,
              }}
            >
              <div
                className={`
                  mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2
                  ${isSelected ? "" : "border-border"}
                `}
                style={{
                  borderColor: isSelected ? modeColor : undefined,
                  backgroundColor: isSelected ? modeColor : "transparent",
                }}
              >
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{option.label}</span>
                  {option.recommended && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: modeColor }}
                    >
                      Odporúčané
                    </span>
                  )}
                </div>
                {option.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {option.description}
                  </p>
                )}
              </div>

              {option.price !== undefined && option.price > 0 && (
                <div
                  className="flex-shrink-0 font-medium"
                  style={{ color: modeColor }}
                >
                  +{option.price.toFixed(2)} €
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
