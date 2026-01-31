import type { Metadata } from "next"
import { Playfair_Display, Work_Sans, Geist_Mono } from "next/font/google"
import { Suspense } from "react"

import { AudienceFooterNote } from "@/components/audience-footer-note"
import { SiteHeader } from "@/components/site-header"
import "./globals.css"

const workSans = Work_Sans({ 
  subsets: ["latin"], 
  variable: "--font-sans",
  display: "swap",
})

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700", "900"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "PrintExpert",
  description: "Tlačové služby a produkty",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sk" className={`${workSans.variable} ${playfairDisplay.variable} ${geistMono.variable}`}>
      <body className="antialiased">
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
          <main
            id="main-content"
            className="flex-1 w-full"
          >
            <div className="container-main py-6 md:py-8 lg:py-10">
              {children}
            </div>
          </main>
          <footer className="border-t bg-muted/30">
            <div className="container-main flex min-h-16 items-center justify-between gap-4 py-4 text-sm text-muted-foreground">
              <span className="font-display text-base font-semibold text-foreground">© PrintExpert</span>
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
