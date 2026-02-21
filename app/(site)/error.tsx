"use client"

import { getCsrfHeader } from "@/lib/csrf"

type ErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function SiteError({ error, reset }: ErrorProps) {
  // Report error to server
  if (typeof window !== "undefined") {
    const payload = {
      name: error.name,
      message: error.message,
      digest: error.digest,
      url: window.location.href,
    }
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-7xl font-bold text-muted-foreground/30">500</span>
        <h1 className="text-2xl font-semibold">Nastala chyba</h1>
        <p className="text-sm text-muted-foreground">
          Niečo sa pokazilo. Skúste stránku obnoviť alebo sa vráťte neskôr.
        </p>
      </div>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
      >
        Skúsiť znova
      </button>
    </main>
  )
}
