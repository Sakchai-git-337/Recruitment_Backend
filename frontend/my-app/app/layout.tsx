import type { Metadata } from "next"
import { IBM_Plex_Sans_Thai } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const font = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-thai",
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
})

export const metadata: Metadata = {
  title: "Recruit — ร่วมงานกับเรา",
  description: "ระบบรับสมัครงาน",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${font.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
