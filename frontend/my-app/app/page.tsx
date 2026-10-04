"use client"

import { PublicShell } from "@/components/app/public-shell"

// temporary stub so the shell can be previewed; replaced by the careers page
export default function Home() {
  return (
    <PublicShell>
      <section className="border-b bg-gradient-to-b from-indigo-50/70 to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">ร่วมงานกับเรา</h1>
          <p className="mt-4 max-w-xl text-lg text-slate-500">ค้นหาตำแหน่งงานที่ใช่ แล้วสมัครออนไลน์ได้ในไม่กี่ขั้นตอน</p>
        </div>
      </section>
    </PublicShell>
  )
}
