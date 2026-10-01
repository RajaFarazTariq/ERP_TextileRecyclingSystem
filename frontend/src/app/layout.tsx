import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter, Manrope } from "next/font/google"

import { AppProviders } from "@/providers/app-providers"
import "./globals.css"

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] })
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "Textile ERP", template: "%s · Textile ERP" },
  description: "Textile recycling ERP: warehouse, processing, sales and reporting.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f0e" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${manrope.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
