import { CheckCircle2 } from "lucide-react"
import { Logo } from "@/components/app/logo"

const PERKS = ["สมัครงานออนไลน์ ไม่ต้องดาวน์โหลดแบบฟอร์ม", "อัปโหลดเอกสารได้ในที่เดียว", "ติดตามสถานะใบสมัครได้ทุกขั้นตอน"]

/** `?next=` must be a same-site path */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-50 via-indigo-100/60 to-white p-12 lg:flex">
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-indigo-200/40 blur-3xl" />
        <Logo />
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-snug font-bold tracking-tight text-slate-900">เริ่มต้นเส้นทางอาชีพของคุณกับเรา</h2>
          <p className="mt-3 text-slate-600">ระบบรับสมัครงานออนไลน์ที่ง่าย รวดเร็ว และโปร่งใส</p>
          <ul className="mt-8 space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-2.5 text-sm text-slate-700">
                <CheckCircle2 className="size-5 shrink-0 text-indigo-600" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} Recruit</p>
      </aside>
      <main className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <Logo className="mb-8 lg:hidden" />
          <div className="rounded-xl border bg-card p-6 shadow-xs sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1 mb-6 text-sm text-slate-500">{subtitle}</p>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
