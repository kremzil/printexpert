"use client"

import Image from "next/image"
import { Check, type LucideIcon } from "lucide-react"

import type { CustomerMode } from "@/components/print/types"
import { ModeButton } from "@/components/print/mode-button"

interface ModeSelectionCardProps {
  mode: CustomerMode
  title: string
  subtitle: string
  description: string
  features: string[]
  icon: LucideIcon
  image: string
  onSelect: () => void
  isPending?: boolean
}

export function ModeSelectionCard({
  mode,
  title,
  subtitle,
  description,
  features,
  icon: Icon,
  image,
  onSelect,
  isPending = false,
}: ModeSelectionCardProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card transition-all hover:border-muted-foreground hover:shadow-2xl"
    >
      <div className="pt-0">
        <div className="relative h-64 overflow-hidden">
          <Image
            src={image}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          <div className="absolute left-6 top-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl">
            <Icon className="h-8 w-8" style={{ color: modeColor }} />
          </div>

          <div className="absolute bottom-6 left-6 right-6">
            <div
              className="mb-1 inline-block rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: modeAccent, color: modeColor }}
            >
              {subtitle}
            </div>
            <h3 className="text-2xl font-bold text-white">{title}</h3>
          </div>
        </div>

        <div className="p-8">
          <p className="mb-6 text-muted-foreground">{description}</p>

          <ul className="mb-8 space-y-3">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: modeAccent }}
                >
                  <Check className="h-3 w-3" style={{ color: modeColor }} />
                </div>
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>

          <ModeButton
            type="button"
            mode={mode}
            size="lg"
            onClick={onSelect}
            disabled={isPending}
            className="w-full py-4 text-center font-semibold hover:shadow-lg"
          >
            Vybrať {title}
          </ModeButton>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity group-hover:opacity-100"
        style={{ boxShadow: `0 0 0 3px ${modeAccent}` }}
      />
    </div>
  )
}
