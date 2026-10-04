"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Lock, Mail } from "lucide-react"
import { api, ApiError, setSession } from "@/lib/api"
import type { User } from "@/lib/types"
import { ErrorText } from "@/components/app-ui"

const SignIn2 = () => {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน")
      return
    }
    if (!validateEmail(email)) {
      setError("รูปแบบอีเมลไม่ถูกต้อง")
      return
    }
    setError("")
    setBusy(true)
    try {
      const { token, user } = await api<{ token: string; user: User }>("/login", { method: "POST", body: { email, password } })
      setSession(token, user)
      router.replace(user.role === "recruitment" ? "/hr/jobs" : "/jobs")
    } catch (e) {
      const status = e instanceof ApiError ? e.status : -1
      setError(
        status === 401 ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
        : (e as Error).message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white rounded-xl z-1">
      <div className="w-full max-w-sm bg-gradient-to-b from-sky-50/50 to-white rounded-3xl shadow-xl shadow-opacity-10 p-8 flex flex-col items-center border border-blue-100 text-black">
        <h2 className="text-2xl font-semibold mb-2 text-center">
          เข้าสู่ระบบ
        </h2>
        <p className="text-gray-500 text-sm mb-6 text-center">
          น้ำไหลคนละจุด เลยรู้สึกคนละแบบ
        </p>

        <form onSubmit={handleSignIn} className="w-full flex flex-col items-center">
          <div className="w-full flex flex-col gap-3 mb-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                placeholder="อีเมล"
                type="email"
                value={email}
                className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                placeholder="รหัสผ่าน"
                type="password"
                value={password}
                className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="w-full">
            <ErrorText message={error} />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-to-b from-gray-700 to-gray-900 text-white font-medium py-2 rounded-xl shadow hover:brightness-105 cursor-pointer transition mb-4 mt-2 disabled:opacity-60"
          >
            {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="text-sm text-gray-500">
          ยังไม่มีบัญชี?{" "}
          <Link href="/register" className="font-medium text-black hover:underline">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </div>
  )
}

export { SignIn2 }
