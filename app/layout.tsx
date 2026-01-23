import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Geist, Geist_Mono, Inter } from "next/font/google"
import { Suspense } from "react"

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { Button } from "@/components/ui/button"
import { AudienceModeSwitch } from "@/components/audience-mode-switch"
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

async function AudienceBadge() {
  const audienceContext = await resolveAudienceContext()
  const label =
    audienceContext.source === "default"
      ? "Vyberte režim"
      : audienceContext.audience === "b2b"
        ? "Pre firmy"
        : "Pre jednotlivcov"
  return (
    <span className="inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold text-muted-foreground sm:text-xs">
      {label}
    </span>
  )
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

async function AudienceHeaderSwitch() {
  const audienceContext = await resolveAudienceContext()
  return <AudienceModeSwitch initialAudience={audienceContext.audience} />
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
          <header className="border-b">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/printexpert-logo.svg"
                  alt="PrintExpert"
                  width={140}
                  height={32}
                  priority
                />
                <span className="sr-only">PrintExpert</span>
              </Link>
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <Link href="/">Domov</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <Link href="/kategorie">Kategórie</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <Link href="/catalog">Katalóg</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <Link href="/kontaktujte-nas">Kontaktujte nás</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/auth">Registrácia</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/account">Môj účet</Link>
                  </Button>
                </div>
                <Suspense fallback={null}>
                  <AudienceHeaderSwitch />
                </Suspense>
                <Suspense fallback={null}>
                  <AudienceBadge />
                </Suspense>
              </div>
            </div>
          </header>
          <main
            id="main-content"
            className="mx-auto w-full max-w-6xl flex-1 px-4 py-8"
          >
            {children}
          </main>
          <footer className="border-t">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 text-sm text-muted-foreground">
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
