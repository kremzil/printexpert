import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Stránka sa nenašla",
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-7xl font-bold text-muted-foreground/30">404</span>
        <h1 className="text-2xl font-semibold">Stránka sa nenašla</h1>
        <p className="text-sm text-muted-foreground">
          Stránka, ktorú hľadáte, neexistuje alebo bola presunutá.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          Späť na úvod
        </Link>
        <Link
          href="/catalog"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border px-5 text-sm font-medium transition-colors hover:bg-accent"
        >
          Katalóg produktov
        </Link>
      </div>
    </main>
  )
}
