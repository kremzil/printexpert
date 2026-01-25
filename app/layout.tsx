import type { Metadata } from "next"
import { Geist, Geist_Mono, Inter } from "next/font/google"
import { Suspense } from "react"

import { SiteHeader } from "@/components/site-header"
import { resolveAudienceContext } from "@/lib/audience-context"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "PrintExpert",
  description: "Tlačové služby a produkty",
}

async function AudienceFooterNote() {
  const audienceContext = await resolveAudienceContext()
  const footerLabel =
    audienceContext.source === "default"
      ? "Režim: nevybraný"
      : audienceContext.audience === "b2b"
        ? "Režim: B2B"
        : "Režim: B2C"
  return <span>{footerLabel}</span>
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sk" className={inter.variable}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex min-h-screen flex-col">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
          >
            Preskočiť na hlavný obsah
          </a>
          <SiteHeader />
          <main
            id="main-content"
            className="mx-auto w-full max-w-7xl flex-1 px-4 py-8"
          >
            {children}
          </main>
          <footer className="border-t">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 text-sm text-muted-foreground">
              <span>© PrintExpert</span>
              <Suspense fallback={null}>
                <AudienceFooterNote />
              </Suspense>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
