import { Suspense } from "react"

import { AudienceFooterNote } from "@/components/audience-footer-note"
import { AudienceModeSwitch } from "@/components/audience-mode-switch"
import { PageTransition } from "@/components/page-transition"
import { ModeOverlayPortal } from "@/components/print/mode-overlay-provider"
import { SiteHeader } from "@/components/site-header"
import { resolveAudienceContext } from "@/lib/audience-context"

async function AudienceFooterSwitch() {
  const audienceContext = await resolveAudienceContext()
  if (audienceContext.source === "default") {
    return null
  }
  return <AudienceModeSwitch initialAudience={audienceContext.audience} />
}

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
      <Suspense fallback={<div className="h-32 border-b" />}>
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
      <footer className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 flex min-h-16 items-center justify-between gap-4 py-4 text-sm text-muted-foreground">
          <span className="font-display text-base font-semibold text-foreground">© PrintExpert</span>
          <Suspense fallback={null}>
            <AudienceFooterNote />
          </Suspense>
          <Suspense fallback={null}>
            <AudienceFooterSwitch />
          </Suspense>
        </div>
      </footer>
    </div>
    </>
  )
}
