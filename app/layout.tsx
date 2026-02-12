import type { Metadata } from "next"
import localFont from "next/font/local"
import { SpeedInsights } from "@vercel/speed-insights/next"

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
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
