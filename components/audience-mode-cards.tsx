"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"

type Props = {
  /**
   * Куда перейти после выбора. Если не задано — остаёмся на /
   * и просто обновляем серверный рендер.
   */
  redirectTo?: string
}

export function AudienceModeCards({ redirectTo }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function pick(audience: "b2b" | "b2c") {
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch("/api/audience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: audience }),
        })

        if (!res.ok) {
          setError("Nepodarilo sa nastaviť režim. Skúste to znova.")
          return
        }

        // Обновляем Server Components, чтобы / сразу увидел новый cookie
        router.refresh()

        // Опционально: сразу увести в каталог/куда надо
        if (redirectTo) router.push(redirectTo)
      } catch (e) {
        console.error(e)
        setError("Nepodarilo sa nastaviť režim. Skúste to znova.")
      }
    })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Som súkromná osoba</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Jednoduchá objednávka, rýchla kalkulácia a hotové produkty.
        </p>
        <Button
          className="mt-4 w-full"
          disabled={isPending}
          onClick={() => pick("b2c")}
        >
          Pokračovať ako súkromná osoba
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Som z firmy</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Individuálny prístup, cenové ponuky a podpora pre firmy.
        </p>
        <Button
          variant="outline"
          className="mt-4 w-full"
          disabled={isPending}
          onClick={() => pick("b2b")}
        >
          Pokračovať ako firma
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive sm:col-span-2" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  )
}
