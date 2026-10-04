"use client"

import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, FileText, LayoutDashboard, LogOut } from "lucide-react"
import { api, logout, useUser } from "@/lib/api"
import { initials } from "@/lib/format"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "./theme-toggle"
import { Logo } from "./logo"
import { cn } from "@/lib/utils"

function UserMenu() {
  const user = useUser()
  const router = useRouter()
  if (user === undefined) return <div className="h-9 w-24" aria-hidden="true" />
  if (user === null) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild><Link href="/login">เข้าสู่ระบบ</Link></Button>
        <Button asChild><Link href="/register">สมัครสมาชิก</Link></Button>
      </div>
    )
  }
  const hr = user.role === "recruitment"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
          <Avatar size="sm">
            <AvatarFallback className="bg-indigo-100 dark:bg-indigo-500/20 text-xs font-semibold text-indigo-700 dark:text-indigo-300">{initials(user.full_name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium text-foreground/80 sm:block">{user.full_name}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{user.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hr ? (
          <DropdownMenuItem onClick={() => router.push("/admin")}><LayoutDashboard /> ไปหลังบ้าน</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => router.push("/me/applications")}><FileText /> ใบสมัครของฉัน</DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => {
            api("/logout", { method: "POST" }).catch(() => {}) // token is read synchronously, before logout() clears it
            logout()
            toast.success("ออกจากระบบแล้ว")
            router.replace("/")
          }}
        >
          <LogOut /> ออกจากระบบ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** top nav + footer for every public page; pages wrap themselves in it (there is no shared public layout). */
export function PublicShell({ children, className, rootClassName }: { children: React.ReactNode; className?: string; rootClassName?: string }) {
  const user = useUser()
  return (
    <div className={cn("flex min-h-screen flex-col bg-muted/40", rootClassName)}>
      <header className="sticky top-0 z-30 border-b bg-card/85 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-1 sm:flex">
              <Link href="/" className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground">ตำแหน่งงาน</Link>
              {user?.role === "applicant" && (
                <Link href="/me/applications" className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground">ใบสมัครของฉัน</Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-1"><ThemeToggle /><UserMenu /></div>
        </div>
      </header>
      <main className={cn("flex-1", className)}>{children}</main>
      <footer className="border-t bg-card print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo className="[&_span:last-child]:text-base" />
          <p>© {new Date().getFullYear()} Recruit · ระบบรับสมัครงานออนไลน์</p>
        </div>
      </footer>
    </div>
  )
}
