"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useUser } from "@/lib/api"
import type { Role } from "@/lib/types"

export const roleHome = (role: Role) => (role === "recruitment" ? "/admin" : "/")

/** no session -> /login?next=<current>; wrong role -> that role's home. Shows a spinner until allowed. */
export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const user = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const allowed = user?.role === role

  useEffect(() => {
    if (user === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    else if (user && user.role !== role) router.replace(roleHome(user.role))
  }, [user, role, pathname, router])

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 className="size-6 animate-spin text-indigo-600 dark:text-indigo-400" aria-label="กำลังโหลด" />
      </div>
    )
  }
  return <>{children}</>
}
