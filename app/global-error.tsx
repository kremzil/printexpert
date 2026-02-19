"use client";

import { useEffect } from "react";

import { getCsrfHeader } from "@/lib/csrf";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    const payload = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    void fetch("/api/client-error", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...getCsrfHeader(),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Silent fail to avoid secondary UI failures in the fallback boundary.
    });
  }, [error]);

  return (
    <html lang="sk">
      <body className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-semibold">Nastala neočakávaná chyba</h1>
          <p className="text-sm text-muted-foreground">
            Skúste stránku obnoviť. Ak problém pretrváva, kontaktujte podporu.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Skúsiť znova
          </button>
        </main>
      </body>
    </html>
  );
}
