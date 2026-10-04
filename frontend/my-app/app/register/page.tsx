"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import type { User } from "@/lib/types"
import { ErrorText, inputClass } from "@/components/app-ui"

const FIELDS = [
  { name: "full_name", label: "ชื่อ-นามสกุล", type: "text" },
  { name: "email", label: "อีเมล", type: "email" },
  { name: "password", label: "รหัสผ่าน", type: "password" },
  { name: "phone", label: "เบอร์โทร", type: "tel" },
] as const

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "" })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      await api<User>("/users", { method: "POST", body: { ...form, role: "applicant" } })
      setDone(true)
    } catch (e) {
      const msg = (e as Error).message
      setError(msg.includes("duplicate") ? "อีเมลนี้ถูกใช้แล้ว" : msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm bg-gradient-to-b from-sky-50/50 to-white rounded-3xl shadow-xl p-8 flex flex-col items-center border border-blue-100 text-black">
        <h1 className="text-2xl font-semibold mb-6 text-center">สมัครสมาชิก</h1>
        {done ? (
          <div className="flex flex-col items-center gap-3">
            <p>สมัครสมาชิกสำเร็จ</p>
            <Link href="/" className="font-medium hover:underline">
              เข้าสู่ระบบ
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="w-full flex flex-col gap-3">
            {FIELDS.map((f) => (
              <label key={f.name} className="flex flex-col gap-1 text-sm">
                {f.label}
                <input
                  required
                  type={f.type}
                  value={form[f.name]}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  className={inputClass}
                />
              </label>
            ))}
            <ErrorText message={error} />
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-to-b from-gray-700 to-gray-900 text-white font-medium py-2 rounded-xl shadow hover:brightness-105 transition mt-2 disabled:opacity-60"
            >
              {busy ? "กำลังสมัคร..." : "สมัครสมาชิก"}
            </button>
            <p className="text-sm text-gray-500 text-center">
              มีบัญชีแล้ว?{" "}
              <Link href="/" className="font-medium text-black hover:underline">
                เข้าสู่ระบบ
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
