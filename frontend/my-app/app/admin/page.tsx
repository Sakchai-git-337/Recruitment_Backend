"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Briefcase, CalendarCheck, CheckCircle2, FileText, Inbox } from "lucide-react"
import { api } from "@/lib/api"
import { countByStatus, type Application, type Job } from "@/lib/types"
import { formatDate } from "@/lib/format"
import { PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/app/stat-card"
import { EmptyState } from "@/components/app/empty-state"
import { ErrorState, LoadingState } from "@/components/app/states"
import { StatusBadge } from "@/components/app/status-badge"
import { PipelineBar } from "@/components/admin/dashboard/pipeline-bar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { initials } from "@/lib/format"

type Data = { jobs: Job[]; apps: Application[] }

const card = "min-w-0 rounded-xl border bg-card shadow-xs"

export default function AdminHome() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState("")
  const [tick, setTick] = useState(0)

  useEffect(() => {
    Promise.all([api<Job[] | null>("/jobs"), api<Application[] | null>("/applications")])
      .then(([jobs, apps]) => {
        setError("")
        setData({ jobs: jobs ?? [], apps: apps ?? [] })
      })
      .catch((e: Error) => setError(e.message))
  }, [tick])

  if (error) return <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} />
  if (!data) return (
    <>
      <PageHeader title="ภาพรวม" description="สรุปการรับสมัครงานทั้งหมด" />
      <LoadingState rows={6} />
    </>
  )

  const { jobs, apps } = data
  const counts = countByStatus(apps)
  const openJobs = jobs.filter((j) => j.status === "open")
  const perJob = new Map<number, number>()
  for (const a of apps) perJob.set(a.job_id, (perJob.get(a.job_id) ?? 0) + 1)
  const recent = [...apps].sort((a, b) => b.apply_date.localeCompare(a.apply_date)).slice(0, 5)

  return (
    <>
      <PageHeader title="ภาพรวม" description="สรุปการรับสมัครงานทั้งหมด" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="ตำแหน่งที่เปิดรับ" value={openJobs.length} icon={Briefcase} hint={`จากทั้งหมด ${jobs.length} ตำแหน่ง`} />
        <StatCard label="ผู้สมัครทั้งหมด" value={apps.length} icon={FileText} />
        <StatCard label="รอสัมภาษณ์" value={counts.interview} icon={CalendarCheck} />
        <StatCard label="ผ่านการคัดเลือก" value={counts.passed} icon={CheckCircle2} />
      </div>

      <section className={`${card} mt-6 p-5`}>
        <h2 className="mb-4 font-semibold text-slate-900">สถานะการสมัคร</h2>
        <PipelineBar counts={counts} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className={`${card} xl:col-span-2`}>
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold text-slate-900">ใบสมัครล่าสุด</h2>
            <Link href="/admin/applications" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">ดูทั้งหมด</Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState icon={Inbox} title="ยังไม่มีใบสมัคร" className="border-0 shadow-none" />
          ) : (
            <ul className="divide-y">
              {recent.map((a) => (
                <li key={a.application_id}>
                  <Link href={`/admin/applications/${a.application_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <Avatar className="size-9"><AvatarFallback className="bg-indigo-50 text-xs font-medium text-indigo-700">{initials(a.applicant_name ?? "?")}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{a.applicant_name ?? `ผู้สมัคร #${a.user_id}`}</p>
                      <p className="truncate text-xs text-slate-500">{a.job_title ?? `#${a.job_id}`} · {formatDate(a.apply_date)}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold text-slate-900">ตำแหน่งที่เปิดรับ</h2>
            <Link href="/admin/jobs" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">จัดการ</Link>
          </div>
          {openJobs.length === 0 ? (
            <EmptyState icon={Briefcase} title="ไม่มีตำแหน่งที่เปิดรับ" className="border-0 shadow-none" />
          ) : (
            <ul className="divide-y">
              {openJobs.slice(0, 6).map((j) => (
                <li key={j.job_id}>
                  <Link href={`/admin/jobs/${j.job_id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{j.title}</p>
                      <p className="truncate text-xs text-slate-500">{j.department || j.location}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{perJob.get(j.job_id) ?? 0} คน</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

