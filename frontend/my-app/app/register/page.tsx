"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { api, setSession } from "@/lib/api"
import type { User } from "@/lib/types"
import { FormField } from "@/components/app/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthLayout, safeNext } from "@/components/public/auth-layout"

type Values = { full_name: string; email: string; phone: string; password: string; confirm: string }

function validate(v: Values): Partial<Record<keyof Values, string>> {
  const e: Partial<Record<keyof Values, string>> = {}
  if (!v.full_name.trim()) e.full_name = "กรุณากรอกชื่อ-นามสกุล"
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = "รูปแบบอีเมลไม่ถูกต้อง"
  if (!/^\d{9,10}$/.test(v.phone.replace(/[-\s]/g, ""))) e.phone = "เบอร์โทรต้องมี 9-10 หลัก"
  if (v.password.length < 6) e.password = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"
  else if (new TextEncoder().encode(v.password).length > 72) e.password = "รหัสผ่านยาวเกินไป"
  if (v.confirm !== v.password) e.confirm = "รหัสผ่านไม่ตรงกัน"
  return e
}

function RegisterForm() {
  const router = useRouter()
  const next = safeNext(useSearchParams().get("next"))
  const [v, setV] = useState<Values>({ full_name: "", email: "", phone: "", password: "", confirm: "" })
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({})
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(v)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const email = v.email.trim()
      await api("/users", { method: "POST", body: { full_name: v.full_name.trim(), email, phone: v.phone.trim(), password: v.password } })
      const res = await api<{ token: string; user: User }>("/login", { method: "POST", body: { email, password: v.password } })
      setSession(res.token, res.user)
      toast.success(`สมัครสมาชิกสำเร็จ ยินดีต้อนรับ ${res.user.full_name}`)
      router.replace(next ?? "/me/applications")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "สมัครสมาชิกไม่สำเร็จ")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormField label="ชื่อ-นามสกุล" id="full_name" required error={errors.full_name}>
        <Input id="full_name" autoComplete="name" placeholder="สมชาย ใจดี" value={v.full_name} onChange={set("full_name")} aria-invalid={!!errors.full_name} />
      </FormField>
      <FormField label="อีเมล" id="email" required error={errors.email}>
        <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={v.email} onChange={set("email")} aria-invalid={!!errors.email} />
      </FormField>
      <FormField label="เบอร์โทรศัพท์" id="phone" required error={errors.phone}>
        <Input id="phone" type="tel" autoComplete="tel" placeholder="0812345678" value={v.phone} onChange={set("phone")} aria-invalid={!!errors.phone} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="รหัสผ่าน" id="password" required error={errors.password} hint="อย่างน้อย 6 ตัวอักษร">
          <Input id="password" type="password" autoComplete="new-password" placeholder="อย่างน้อย 6 ตัวอักษร" value={v.password} onChange={set("password")} aria-invalid={!!errors.password} />
        </FormField>
        <FormField label="ยืนยันรหัสผ่าน" id="confirm" required error={errors.confirm}>
          <Input id="confirm" type="password" autoComplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง" value={v.confirm} onChange={set("confirm")} aria-invalid={!!errors.confirm} />
        </FormField>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} สมัครสมาชิก
      </Button>
      <p className="pt-2 text-center text-sm text-slate-500">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-indigo-600 hover:underline">เข้าสู่ระบบ</Link>
      </p>
    </form>
  )
}

export default function RegisterPage() {
  return (
    <AuthLayout title="สร้างบัญชีใหม่" subtitle="สมัครสมาชิกเพื่อเริ่มสมัครงานออนไลน์">
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </AuthLayout>
  )
}
