"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Plus, Search, SearchX, Users } from "lucide-react"
import { toast } from "sonner"
import { api, useUser } from "@/lib/api"
import type { Role, User } from "@/lib/types"
import { EmptyState } from "@/components/app/empty-state"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { PageHeader } from "@/components/app/page-header"
import { ErrorState, LoadingState } from "@/components/app/states"
import { UserDialog } from "@/components/admin/users/user-dialog"
import { UsersTable } from "@/components/admin/users/users-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Filter = "all" | Role

function UsersPage() {
  const me = useUser()
  const [users, setUsers] = useState<User[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [tab, setTab] = useState<Filter>("all")
  const [creating, setCreating] = useState(useSearchParams().get("new") === "1")
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(() => {
    api<User[]>("/users")
      .then((u) => { setUsers(u ?? []); setError(null) })
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"))
  }, [])
  useEffect(load, [load])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (users ?? []).filter(
      (u) => (tab === "all" || u.role === tab) &&
        (!s || u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || u.phone.includes(s)),
    )
  }, [users, q, tab])

  async function changeRole(u: User, role: Role) {
    if (role === u.role) return
    setBusyId(u.user_id)
    try {
      await api(`/users/${u.user_id}`, { method: "PATCH", body: { role } })
      toast.success(`เปลี่ยนสิทธิ์ของ ${u.full_name} เป็น ${role === "recruitment" ? "HR" : "ผู้สมัคร"} แล้ว`)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เปลี่ยนสิทธิ์ไม่สำเร็จ")
    } finally {
      setBusyId(null)
    }
  }

  async function remove(u: User) {
    try {
      await api(`/users/${u.user_id}`, { method: "DELETE" })
      toast.success("ลบผู้ใช้แล้ว")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ")
      throw e
    }
  }

  const add = (
    <Button onClick={() => setCreating(true)}><Plus /> เพิ่มผู้ใช้</Button>
  )

  return (
    <>
      <PageHeader title="ผู้ใช้" description="จัดการบัญชีผู้สมัครและเจ้าหน้าที่ HR" actions={add} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
            <TabsTrigger value="recruitment">HR</TabsTrigger>
            <TabsTrigger value="applicant">ผู้สมัคร</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร"
            className="bg-white pl-9" aria-label="ค้นหาผู้ใช้"
          />
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => { setError(null); load() }} />
      ) : !users ? (
        <LoadingState rows={6} />
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="ยังไม่มีผู้ใช้" text="เริ่มต้นด้วยการเพิ่มผู้ใช้คนแรก" action={add} />
      ) : shown.length === 0 ? (
        <EmptyState icon={SearchX} title="ไม่พบผู้ใช้ที่ตรงกัน" text="ลองเปลี่ยนคำค้นหาหรือตัวกรองสิทธิ์" />
      ) : (
        <UsersTable users={shown} meId={me?.user_id} busyId={busyId} onEdit={setEditing} onDelete={setDeleting} onRole={changeRole} />
      )}

      {creating && (
        <UserDialog open user={null} onOpenChange={setCreating} onSaved={load} />
      )}
      {editing && (
        <UserDialog
          key={editing.user_id} open user={editing} isSelf={editing.user_id === me?.user_id}
          onOpenChange={(o) => !o && setEditing(null)} onSaved={load}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`ลบผู้ใช้ ${deleting?.full_name ?? ""}?`}
        description="ใบสมัครทั้งหมดของผู้ใช้คนนี้จะถูกลบไปด้วย และไม่สามารถกู้คืนได้"
        confirmLabel="ลบผู้ใช้"
        destructive
        onConfirm={() => deleting ? remove(deleting) : undefined}
      />
    </>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <UsersPage />
    </Suspense>
  )
}
