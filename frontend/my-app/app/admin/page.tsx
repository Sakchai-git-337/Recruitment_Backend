"use client"

import { Briefcase, CalendarCheck, CheckCircle2, FileText } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/app/stat-card"
import { EmptyState } from "@/components/app/empty-state"

// temporary stub so the shell can be previewed; replaced by the dashboard task
export default function AdminHome() {
  return (
    <>
      <PageHeader title="ภาพรวม" description="สรุปการรับสมัครงานทั้งหมด" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="ตำแหน่งที่เปิดรับ" value="-" icon={Briefcase} />
        <StatCard label="ผู้สมัครทั้งหมด" value="-" icon={FileText} />
        <StatCard label="รอสัมภาษณ์" value="-" icon={CalendarCheck} />
        <StatCard label="ผ่านการคัดเลือก" value="-" icon={CheckCircle2} />
      </div>
      <EmptyState className="mt-6" title="แดชบอร์ดกำลังจัดทำ" text="ข้อมูลสรุปและใบสมัครล่าสุดจะแสดงที่นี่" />
    </>
  )
}
