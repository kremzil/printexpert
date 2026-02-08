import type { Metadata } from "next"
import { Playfair_Display, Work_Sans, Geist_Mono } from "next/font/google"

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
        {children}
      </body>
    </html>
  )
}
