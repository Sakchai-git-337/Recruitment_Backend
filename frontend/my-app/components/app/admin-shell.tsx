"use client"

import { toast } from "sonner"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Briefcase, FileText, LayoutDashboard, LogOut, Menu, UserCog, type LucideIcon } from "lucide-react"
import { api, logout, useUser } from "@/lib/api"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Logo } from "./logo"

const NAV: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/admin", label: "ภาพรวม", icon: LayoutDashboard, exact: true },
  { href: "/admin/jobs", label: "ตำแหน่งงาน", icon: Briefcase },
  { href: "/admin/applications", label: "ผู้สมัคร", icon: FileText },
  { href: "/admin/users", label: "ผู้ใช้", icon: UserCog },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useUser()
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b px-5">
        <Logo href="/admin" />
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className={cn("size-[18px]", active ? "text-indigo-600" : "text-slate-400")} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <Avatar>
            <AvatarFallback className="bg-indigo-100 text-xs font-semibold text-indigo-700">{initials(user?.full_name ?? "")}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{user?.full_name ?? " "}</p>
            <p className="truncate text-xs text-slate-500">{user?.email ?? " "}</p>
          </div>
          <Button
            variant="ghost" size="icon" aria-label="ออกจากระบบ" title="ออกจากระบบ"
            onClick={() => {
              api("/logout", { method: "POST" }).catch(() => {}) // token is read synchronously, before logout() clears it
              logout()
              toast.success("ออกจากระบบแล้ว")
              router.replace("/login")
            }}
          >
            <LogOut className="size-4 text-slate-500" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/** left sidebar (>= lg) / Sheet from a top bar (< lg). Wrap admin pages; app/admin/layout.tsx does this inside RequireRole. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-white lg:block print:hidden">
        <SidebarContent />
      </aside>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur lg:hidden print:hidden">
        <Button variant="ghost" size="icon" aria-label="เปิดเมนู" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </Button>
        <Logo href="/admin" />
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-60 gap-0 p-0 data-[side=left]:sm:max-w-60">
          <SheetTitle className="sr-only">เมนู</SheetTitle>
          <SheetDescription className="sr-only">เมนูนำทางผู้ดูแลระบบ</SheetDescription>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <main className="lg:pl-60 print:pl-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  )
}
