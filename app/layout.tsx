import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import type { ReactNode } from "react"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Orbital Skill Habitat",
  description:
    "A self-evolving 3D training ground for embodied agents — learn, replay, and generate skills in microgravity.",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#0a1020",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh" className={`${inter.variable} ${mono.variable} bg-background dark`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
