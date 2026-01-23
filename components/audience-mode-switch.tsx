"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Switch } from "@/components/ui/switch"

type AudienceModeSwitchProps = {
  initialAudience: "b2b" | "b2c"
}

export function AudienceModeSwitch({
  initialAudience,
}: AudienceModeSwitchProps) {
  const router = useRouter()
  const initialChecked = initialAudience === "b2b"
  const [checked, setChecked] = useState(initialChecked)
  const [isPending, startTransition] = useTransition()

  const handleToggle = (nextChecked: boolean) => {
    setChecked(nextChecked)
    startTransition(async () => {
      const response = await fetch("/api/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextChecked ? "b2b" : "b2c" }),
      })
      if (!response.ok) {
        setChecked(!nextChecked)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium text-muted-foreground sm:text-xs">
        B2C
      </span>
      <Switch
        checked={checked}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label="Prepnutie režimu B2B a B2C"
      />
      <span className="text-[10px] font-medium text-muted-foreground sm:text-xs">
        B2B
      </span>
    </div>
  )
}
