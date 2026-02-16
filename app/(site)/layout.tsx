import { Suspense } from "react"

import { PageTransition } from "@/components/page-transition"
import { ModeOverlayPortal } from "@/components/print/mode-overlay-provider"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
    <ModeOverlayPortal />
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Preskočiť na hlavný obsah
      </a>
      <Suspense fallback={
        <>
          <div className="sticky top-0 z-50 bg-background/95 border-b border-border/30">
            <div className="mx-auto w-full max-w-480 lg:px-8">
              <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 md:px-8" />
            </div>
          </div>
          <div className="sticky top-16 z-40 hidden lg:block bg-background/95 border-b border-border/30">
            <div className="mx-auto w-full max-w-480">
              <div className="flex h-12 items-center px-4 sm:px-6 md:px-8" />
            </div>
          </div>
        </>
      }>
        <SiteHeader />
      </Suspense>
      <main id="main-content" className="flex-1 w-full">
        <Suspense
          fallback={
            <div className="page-transition page-transition-enter">
              {children}
            </div>
          }
        >
          <PageTransition>{children}</PageTransition>
        </Suspense>
      </main>
      <SiteFooter />
    </div>
    </>
  )
}
