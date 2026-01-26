"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Building2, User } from "lucide-react"

type AudienceModeSwitchProps = {
  initialAudience: "b2b" | "b2c"
}

export function AudienceModeSwitch({ initialAudience }: AudienceModeSwitchProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // checked: true = b2b, false = b2c
  const [checked, setChecked] = useState(initialAudience === "b2b")

  useEffect(() => {
    setChecked(initialAudience === "b2b")
  }, [initialAudience])

  const onCheckedChange = (nextChecked: boolean) => {
    setChecked(nextChecked)
    startTransition(async () => {
      try {
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
      } catch (e) {
        console.error(e)
        setChecked(!nextChecked)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span 
        className={cn(
          "text-xs font-medium transition-colors flex items-center gap-1.5",
          !checked ? "text-[#0a1833] font-bold" : "text-muted-foreground"
        )}
      >
        <User className="h-3.5 w-3.5" />
        Osoba
      </span>
      
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={isPending}
        aria-label="Audience mode"
        className={cn(
            "data-[state=checked]:bg-[#e43b11] data-[state=unchecked]:bg-[#0a1833]",
            "border-2 border-transparent hover:border-border/20"
        )}
      />
      
      <span 
        className={cn(
          "text-xs font-medium transition-colors flex items-center gap-1.5",
          checked ? "text-[#e43b11] font-bold" : "text-muted-foreground"
        )}
      >
        <Building2 className="h-3.5 w-3.5" />
        Firma
      </span>
    </div>
  )
}