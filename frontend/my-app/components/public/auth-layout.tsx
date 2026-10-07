import { CheckCircle2 } from "lucide-react"
import { Logo } from "@/components/app/logo"
import { ThemeToggle } from "@/components/app/theme-toggle"

const PERKS = ["สมัครงานออนไลน์ ไม่ต้องดาวน์โหลดแบบฟอร์ม", "อัปโหลดเอกสารได้ในที่เดียว", "ติดตามสถานะใบสมัครได้ทุกขั้นตอน"]

export { safeNext } from "@/lib/safe-next"

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen bg-muted/40 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <ThemeToggle className="absolute top-3 right-3 z-10" />
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-100 via-indigo-200/60 to-indigo-50 dark:from-indigo-950 dark:via-indigo-900/50 dark:to-slate-950 p-12 lg:flex">
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-indigo-300/40 dark:bg-indigo-500/20 blur-3xl" />
        <Logo />
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-snug font-bold tracking-tight text-foreground">เริ่มต้นเส้นทางอาชีพของคุณกับเรา</h2>
          <p className="mt-3 text-foreground/70">ระบบรับสมัครงานออนไลน์ที่ง่าย รวดเร็ว และโปร่งใส</p>
          <ul className="mt-8 space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-2.5 text-sm text-foreground/80">
                <CheckCircle2 className="size-5 shrink-0 text-indigo-600 dark:text-indigo-400" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} MAIRU</p>
      </aside>
      <main className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <Logo className="mb-8 lg:hidden" />
          <div className="rounded-xl border bg-card p-6 shadow-xs sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">{subtitle}</p>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
