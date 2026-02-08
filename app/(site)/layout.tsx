import { Suspense } from "react"

import { AudienceFooterNote } from "@/components/audience-footer-note"
import { PageTransition } from "@/components/page-transition"
import { SiteHeader } from "@/components/site-header"

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Preskočiť na hlavný obsah
      </a>
      <Suspense fallback={<div className="h-32 border-b" />}>
        <SiteHeader />
      </Suspense>
      <main id="main-content" className="flex-1 w-full">
        <PageTransition>{children}</PageTransition>
      </main>
      <footer className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 flex min-h-16 items-center justify-between gap-4 py-4 text-sm text-muted-foreground">
          <span className="font-display text-base font-semibold text-foreground">© PrintExpert</span>
          <Suspense fallback={null}>
            <AudienceFooterNote />
          </Suspense>
        </div>
      </footer>
    </div>
  )
}
