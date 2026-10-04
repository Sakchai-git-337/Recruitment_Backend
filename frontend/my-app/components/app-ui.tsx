"use client"

import { useEffect, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { api, logout, useUser } from "@/lib/api"
import { APP_STATUSES, APP_STATUS_LABEL, type AppStatus, type Role } from "@/lib/types"

export const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"

export function Loading() {
  return <p className="p-6 text-sm text-gray-500">กำลังโหลด...</p>
}

export function ErrorText({ message }: { message: string }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
      {message}
    </p>
  )
}

export function StatusBar({ value, onChange }: { value: AppStatus; onChange?: (s: AppStatus) => void }) {
  return (
    <div className="flex w-fit max-w-full flex-wrap overflow-hidden rounded-lg border border-gray-200 bg-white text-xs sm:text-sm">
      {APP_STATUSES.map((s) => {
        const active = s === value
        const activeClass = s === "rejected" ? "bg-red-600 text-white" : "bg-gray-900 text-white"
        return (
          <button
            key={s}
            type="button"
            disabled={!onChange || active}
            aria-current={active ? "step" : undefined}
            onClick={() => onChange?.(s)}
            className={`border-r border-gray-200 px-3 py-1.5 last:border-r-0 ${active ? activeClass : "text-gray-600 enabled:hover:bg-gray-50"}`}
          >
            {APP_STATUS_LABEL[s]}
          </button>
        )
      })}
    </div>
  )
}

type NavLink = { href: string; label: string }

export function RoleGate({ role, links, children }: { role: Role; links: NavLink[]; children: ReactNode }) {
  const user = useUser()
  const router = useRouter()
  const allowed = user?.role === role

  useEffect(() => {
    if (user !== undefined && !allowed) router.replace("/")
  }, [user, allowed, router])

  if (!user || user.role !== role) return <Loading />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <span className="font-semibold">Recruitment</span>
          <nav className="flex gap-3 text-sm text-gray-600">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-gray-900">
                {l.label}
              </Link>
            ))}
          </nav>
          <span className="ml-auto hidden text-sm text-gray-500 sm:inline">{user.full_name}</span>
          <button
            type="button"
            onClick={() => {
              api("/logout", { method: "POST" }).catch(() => {})
              logout()
              router.replace("/")
            }}
            className="ml-auto flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 sm:ml-0"
          >
            <LogOut className="size-4" /> ออกจากระบบ
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  )
}
