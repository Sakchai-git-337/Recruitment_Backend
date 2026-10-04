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

function LoginForm() {
  const router = useRouter()
  const next = safeNext(useSearchParams().get("next"))
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return setError("กรุณากรอกอีเมลและรหัสผ่าน")
    setBusy(true)
    setError("")
    try {
      const res = await api<{ token: string; user: User }>("/login", { method: "POST", body: { email: email.trim(), password } })
      setSession(res.token, res.user)
      router.replace(res.user.role === "recruitment" ? "/admin" : (next ?? "/me/applications"))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ"
      setError(msg)
      toast.error(msg)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormField label="อีเมล" id="email" required>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </FormField>
      <FormField label="รหัสผ่าน" id="password" required>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่านของคุณ" />
      </FormField>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} เข้าสู่ระบบ
      </Button>
      <p className="pt-2 text-center text-sm text-slate-500">
        ยังไม่มีบัญชี?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-indigo-600 hover:underline">สมัครสมาชิก</Link>
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <AuthLayout title="เข้าสู่ระบบ" subtitle="ยินดีต้อนรับกลับมา กรอกข้อมูลเพื่อเข้าสู่ระบบ">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  )
}
