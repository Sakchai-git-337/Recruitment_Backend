import type { Metadata } from "next"
import { IBM_Plex_Sans_Thai } from "next/font/google"
import { ThemeProvider } from "@/components/app/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const font = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-thai",
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
})

export const metadata: Metadata = {
  title: "MAIRU — ร่วมงานกับเรา",
  description: "ระบบรับสมัครงาน",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" suppressHydrationWarning className={`${font.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors closeButton position="top-right" offset={{ top: 76 }} mobileOffset={{ top: 64 }} />
        </ThemeProvider>
      </body>
    </html>
  )
}
