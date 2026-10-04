import { AdminShell } from "@/components/app/admin-shell"
import { RequireRole } from "@/components/app/require-role"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="recruitment">
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  )
}
