import Link from "next/link"
import { ShoppingCart } from "lucide-react"

import type { CustomerMode } from "@/components/print/types"

interface EmptyCartProps {
  mode: CustomerMode
}

export function EmptyCart({ mode }: EmptyCartProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  return (
    <div className="w-full">
      <div className="py-12">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: modeAccent }}
          >
            <ShoppingCart className="h-8 w-8" style={{ color: modeColor }} />
          </div>
          <h1 className="mb-2 text-2xl font-bold">Váš košík je prázdny</h1>
          <p className="mb-6 text-muted-foreground">
            Pridajte produkty do košíka, aby ste mohli pokračovať k objednávke.
          </p>
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
            style={{ backgroundColor: modeColor }}
          >
            Prejsť do katalógu
          </Link>
        </div>
      </div>
    </div>
  )
}
