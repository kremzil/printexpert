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
    <div className="grid gap-6 sm:grid-cols-2">
      {/* B2C Card */}
      <div className="group relative overflow-hidden rounded-lg border border-primary/20 bg-card p-8 transition-all duration-300 hover:border-primary hover:shadow-xl">
        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl transition-all duration-500 group-hover:scale-150" />
        <div className="relative space-y-4">
          <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Pre jednotlivcov
          </div>
          <h2 className="font-display text-2xl font-bold">Som súkromná osoba</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Jednoduchá objednávka, rýchla kalkulácia a hotové produkty.
          </p>
          <Button
            size="lg"
            className="group/btn mt-6 w-full ink-spread shadow-md transition-all hover:shadow-xl hover:bg-primary/90"
            disabled={isPending}
            onClick={() => pick("b2c")}
          >
            Pokračovať ako súkromná osoba
            <span className="ml-2 transition-transform duration-200 group-hover/btn:translate-x-1">→</span>
          </Button>
        </div>
      </div>

      {/* B2B Card */}
      <div className="group relative overflow-hidden rounded-lg border border-primary/20 bg-card p-8 transition-all duration-300 hover:border-primary hover:shadow-xl">
        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/10 blur-3xl transition-all duration-500 group-hover:scale-150" />
        <div className="relative space-y-4">
          <div className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-foreground">
            Pre firmy
          </div>
          <h2 className="font-display text-2xl font-bold">Som z firmy</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Individuálny prístup, cenové ponuky a podpora pre firmy.
          </p>
          <Button
            variant="default"
            size="lg"
            className="mt-6 w-full print-frame bg-foreground text-background hover:bg-foreground/90 shadow-md transition-all hover:shadow-xl"
            disabled={isPending}
            onClick={() => pick("b2b")}
          >
            Pokračovať ako firma
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm font-medium text-destructive sm:col-span-2" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  )
}
