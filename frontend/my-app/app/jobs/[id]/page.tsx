"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Check, FileSearch } from "lucide-react"
import { api, ApiError, useUser } from "@/lib/api"
import { formatDate, formatSalaryRange } from "@/lib/format"
import { EMPLOYMENT_TYPE_LABEL, type Application, type Job } from "@/lib/types"
import { PublicShell } from "@/components/app/public-shell"
import { EmptyState } from "@/components/app/empty-state"
import { ErrorState } from "@/components/app/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MetaItem, TypeBadge, isJobOpen, jobMeta } from "@/components/public/job-utils"

function Section({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null
  return (
    <section className="rounded-xl border bg-card p-6 shadow-xs">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-3 leading-relaxed whitespace-pre-line text-slate-600">{text}</p>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  )
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useUser()
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [applied, setApplied] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    api<Job>(`/jobs/${id}`)
      .then((j) => live && (setJob(j), setError(null)))
      .catch((e: Error) => live && setError(e))
    return () => { live = false }
  }, [id, attempt])

  const isApplicant = user?.role === "applicant"
  useEffect(() => {
    if (!isApplicant) return
    let live = true
    api<Application[]>("/applications")
      .then((apps) => live && setApplied(apps.some((a) => String(a.job_id) === id)))
      .catch(() => {})
    return () => { live = false }
  }, [isApplicant, id])

  const retry = () => { setError(null); setJob(null); setAttempt((n) => n + 1) }
  const notFound = error instanceof ApiError && error.status === 404

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <nav className="mb-6 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-900">ตำแหน่งงาน</Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-700">{job?.title ?? "รายละเอียด"}</span>
        </nav>

        {notFound ? (
          <EmptyState icon={FileSearch} title="ไม่พบตำแหน่งงานนี้" text="ตำแหน่งอาจถูกลบหรือลิงก์ไม่ถูกต้อง"
            action={<Button asChild><Link href="/">กลับไปดูตำแหน่งงานทั้งหมด</Link></Button>} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={retry} />
        ) : !job ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]" aria-busy="true">
            <div className="space-y-4"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <JobBody job={job} role={user === undefined ? undefined : user?.role ?? null} applied={applied} />
        )}
      </div>
    </PublicShell>
  )
}

function JobBody({ job, role, applied }: { job: Job; role: "applicant" | "recruitment" | null | undefined; applied: boolean }) {
  const m = jobMeta(job)
  const open = isJobOpen(job)
  const next = encodeURIComponent(`/jobs/${job.job_id}/apply`)

  let action: React.ReactNode
  if (!open) action = <Button size="lg" className="w-full" disabled>ปิดรับสมัครแล้ว</Button>
  else if (role === undefined) action = <Button size="lg" className="w-full" disabled>กำลังโหลด...</Button>
  else if (role === null) action = <Button size="lg" className="w-full" asChild><Link href={`/login?next=${next}`}>เข้าสู่ระบบเพื่อสมัคร</Link></Button>
  else if (role === "recruitment") action = <Button size="lg" className="w-full" variant="outline" asChild><Link href={`/admin/jobs/${job.job_id}`}>จัดการตำแหน่งนี้</Link></Button>
  else if (applied) action = <Button size="lg" className="w-full" variant="secondary" asChild><Link href="/me/applications"><Check /> สมัครแล้ว</Link></Button>
  else action = <Button size="lg" className="w-full" asChild><Link href={`/jobs/${job.job_id}/apply`}>สมัครงานนี้</Link></Button>

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <header className="rounded-xl border bg-gradient-to-br from-indigo-50/70 to-white p-6 shadow-xs sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={job.employment_type} />
            {!open && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">ปิดรับสมัคร</span>}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{job.title}</h1>
          {m.department && <p className="mt-1 text-slate-500">{m.department.text}</p>}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            {m.location && <MetaItem icon={m.location.icon}>{m.location.text}</MetaItem>}
            <MetaItem icon={m.salary.icon}>{m.salary.text}</MetaItem>
            <MetaItem icon={m.headcount.icon}>{m.headcount.text}</MetaItem>
            {m.closing && <MetaItem icon={m.closing.icon}>{m.closing.text}</MetaItem>}
          </div>
        </header>
        <Section title="รายละเอียดงาน" text={job.description} />
        <Section title="คุณสมบัติผู้สมัคร" text={job.requirement} />
      </div>

      <aside className="rounded-xl border bg-card p-5 shadow-xs lg:sticky lg:top-24">
        <h2 className="text-base font-semibold text-slate-900">สรุปตำแหน่ง</h2>
        <dl className="mt-2 divide-y">
          <Row label="ประเภทงาน" value={EMPLOYMENT_TYPE_LABEL[job.employment_type] ?? job.employment_type} />
          <Row label="เงินเดือน" value={formatSalaryRange(job.salary_min, job.salary_max)} />
          <Row label="จำนวนที่รับ" value={`${job.headcount} อัตรา`} />
          <Row label="ปิดรับสมัคร" value={job.closing_date ? formatDate(job.closing_date) : "ไม่กำหนด"} />
        </dl>
        <div className="mt-4">{action}</div>
      </aside>
    </div>
  )
}
