"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Switch } from "@/components/ui/switch"

type AudienceModeSwitchProps = {
  initialAudience: "b2b" | "b2c"
}

export function AudienceModeSwitch({ initialAudience }: AudienceModeSwitchProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // checked: true = b2b, false = b2c (как у тебя)
  const [checked, setChecked] = useState(initialAudience === "b2b")

  // ✅ ВАЖНО: если аудитория сменилась извне (карточки/другая страница),
  // сервер пришлет новый initialAudience после router.refresh().
  // Синхронизируем UI свитчера.
  useEffect(() => {
    setChecked(initialAudience === "b2b")
  }, [initialAudience])

  const onCheckedChange = (nextChecked: boolean) => {
    // оптимистично обновляем UI
    setChecked(nextChecked)

    startTransition(async () => {
      try {
        const response = await fetch("/api/audience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: nextChecked ? "b2b" : "b2c" }),
        })

        if (!response.ok) {
          // откатываем UI, если API не принял
          setChecked(!nextChecked)
          return
        }

        // ✅ заставляем серверные компоненты перечитаться с новой cookie
        router.refresh()
      } catch (e) {
        console.error(e)
        setChecked(!nextChecked)
      }
    })
  }

  return (
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={isPending}
      aria-label="Audience mode"
    />
  )
}