"use client"

import { getCsrfHeader } from "@/lib/csrf"

type ErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AdminError({ error, reset }: ErrorProps) {
  if (typeof window !== "undefined") {
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({
        name: error.name,
        message: error.message,
        digest: error.digest,
        url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => {})
  }

  return (
    <div className="flex-1 p-6">
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-5 py-20 text-center">
        <span className="text-6xl font-bold text-muted-foreground/30">Chyba</span>
        <p className="text-sm text-muted-foreground">
          V administrácii nastala neočakávaná chyba.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Skúsiť znova
        </button>
      </div>
    </div>
  )
}
