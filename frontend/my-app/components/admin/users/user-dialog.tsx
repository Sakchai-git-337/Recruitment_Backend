"use client"

import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Role, User } from "@/lib/types"
import { FormField } from "@/components/app/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export const ROLE_LABEL: Record<Role, string> = { recruitment: "HR", applicant: "ผู้สมัคร" }

type Errors = Partial<Record<"full_name" | "email" | "password", string>>

/** user = null creates; user set edits. Mount with a `key` so state resets per target. */
export function UserDialog({
  open, onOpenChange, user, isSelf, onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  isSelf?: boolean
  onSaved: () => void
}) {
  const [f, setF] = useState({
    full_name: user?.full_name ?? "", email: user?.email ?? "", phone: user?.phone ?? "",
    password: "", role: (user?.role ?? "applicant") as Role,
  })
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const er: Errors = {}
    if (!f.full_name.trim()) er.full_name = "กรุณากรอกชื่อ-นามสกุล"
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = "รูปแบบอีเมลไม่ถูกต้อง"
    if (!user && !f.password) er.password = "กรุณากรอกรหัสผ่าน"
    setErrors(er)
    if (Object.keys(er).length) return
    setBusy(true)
    try {
      const base = { full_name: f.full_name.trim(), email: f.email.trim(), phone: f.phone.trim() }
      if (user) {
        const body: Record<string, string> = { ...base }
        if (!isSelf) body.role = f.role
        if (f.password) body.password = f.password
        await api(`/users/${user.user_id}`, { method: "PATCH", body })
      } else {
        await api("/admin/users", { method: "POST", body: { ...base, password: f.password, role: f.role } })
      }
      toast.success(user ? "บันทึกข้อมูลแล้ว" : "เพิ่มผู้ใช้แล้ว")
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</DialogTitle>
          <DialogDescription>{user ? "แก้ไขข้อมูลบัญชีผู้ใช้" : "สร้างบัญชีใหม่ให้ผู้สมัครหรือเจ้าหน้าที่ HR"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField label="ชื่อ-นามสกุล" id="u-name" required error={errors.full_name}>
            <Input id="u-name" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} autoComplete="off" />
          </FormField>
          <FormField label="อีเมล" id="u-email" required error={errors.email}>
            <Input id="u-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="เบอร์โทร" id="u-phone">
              <Input id="u-phone" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </FormField>
            <FormField label="สิทธิ์" id="u-role" hint={isSelf ? "เปลี่ยนสิทธิ์ของตัวเองไม่ได้" : undefined}>
              <Select value={f.role} onValueChange={(v) => set("role", v)} disabled={isSelf}>
                <SelectTrigger id="u-role" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="applicant">{ROLE_LABEL.applicant}</SelectItem>
                  <SelectItem value="recruitment">{ROLE_LABEL.recruitment}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField
            label={user ? "รหัสผ่านใหม่" : "รหัสผ่าน"} id="u-pass" required={!user} error={errors.password}
            hint={user ? "เว้นว่างไว้หากไม่ต้องการเปลี่ยน" : undefined}
          >
            <Input id="u-pass" type="password" value={f.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={busy}>{busy ? "กำลังบันทึก..." : user ? "บันทึก" : "เพิ่มผู้ใช้"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
