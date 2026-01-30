"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Building2, User } from "lucide-react"

type AudienceModeSwitchProps = {
  initialAudience: "b2b" | "b2c"
}

export function AudienceModeSwitch({ initialAudience }: AudienceModeSwitchProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<"b2b" | "b2c">(initialAudience)

  useEffect(() => {
    setMode(initialAudience)
  }, [initialAudience])

  const handleModeChange = (nextMode: "b2b" | "b2c") => {
    if (isPending || nextMode === mode) {
      return
    }
    const previous = mode
    setMode(nextMode)
    startTransition(async () => {
      try {
        const response = await fetch("/api/audience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: nextMode }),
        })
        if (!response.ok) {
          setMode(previous)
          return
        }
        router.refresh()
      } catch (e) {
        console.error(e)
        setMode(previous)
      }
    })
  }

  return (
    <div className="inline-flex rounded-lg border border-border bg-background p-1">
      <button
        type="button"
        onClick={() => handleModeChange("b2c")}
        disabled={isPending}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
          mode === "b2c"
            ? "bg-[var(--b2c-primary)] text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <User className="h-4 w-4" />
        B2C
      </button>
      <button
        type="button"
        onClick={() => handleModeChange("b2b")}
        disabled={isPending}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
          mode === "b2b"
            ? "bg-[var(--b2b-primary)] text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Building2 className="h-4 w-4" />
        B2B
      </button>
    </div>
  )
}
