import type { Metadata } from "next"
import localFont from "next/font/local"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from '@vercel/analytics/next';

import { MarketingConsentGate } from "@/components/analytics/marketing-consent-gate"
import { ROOT_METADATA, SITE_NAME, SITE_URL, toJsonLd } from "@/lib/seo"

import "./globals.css"

const workSans = localFont({
  src: [
    {
      path: "../public/fonts/work-sans-latin-ext.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../public/fonts/work-sans-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-work-sans",
  display: "swap",
  adjustFontFallback: "Arial",
})

const playfairDisplay = localFont({
  src: [
    {
      path: "../public/fonts/playfair-display-latin-ext.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/playfair-display-latin.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/playfair-display-latin-ext.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/playfair-display-latin.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/playfair-display-latin-ext.woff2",
      weight: "900",
      style: "normal",
    },
    {
      path: "../public/fonts/playfair-display-latin.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-playfair-display",
  display: "swap",
  adjustFontFallback: "Times New Roman",
})

const geistMono = localFont({
  src: [
    {
      path: "../public/fonts/geist-mono-latin-ext.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../public/fonts/geist-mono-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-geist-mono",
  display: "swap",
  adjustFontFallback: false,
  preload: false,
})

export const metadata: Metadata = ROOT_METADATA

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/printexpert-logo.png`,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: "+421-917-545-003",
        email: "info@printexpert.sk",
        availableLanguage: ["sk"],
      },
    ],
  }

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "sk-SK",
  }

  return (
    <html lang="sk" className={`${workSans.variable} ${playfairDisplay.variable} ${geistMono.variable}`}>
      <body className={`${workSans.className} antialiased`}>
        <MarketingConsentGate />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(websiteJsonLd) }}
        />
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
