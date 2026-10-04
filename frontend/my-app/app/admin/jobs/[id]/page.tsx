"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Building2, CalendarClock, MapPin, Pencil, Users, Wallet, Briefcase } from "lucide-react"
import { api } from "@/lib/api"
import { EMPLOYMENT_TYPE_LABEL, type Job } from "@/lib/types"
import { formatDate, formatSalaryRange } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/app/page-header"
import { LoadingState, ErrorState } from "@/components/app/states"
import { JobStatusBadge } from "@/components/app/status-badge"
import { isJobOpen } from "@/components/public/job-utils"
import { JobPipeline } from "@/components/admin/jobs/job-pipeline"

function Meta({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-foreground/70">
      <Icon className="size-4 text-muted-foreground" />
      {children}
    </span>
  )
}

export default function AdminJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState("")
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    api<Job>(`/jobs/${id}`)
      .then((j) => { if (live) { setJob(j); setError("") } })
      .catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [id, tick])

  if (error) return <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} />
  if (!job) return <LoadingState rows={6} />

  return (
    <>
      <PageHeader
        title={job.title}
        breadcrumb={[{ label: "ตำแหน่งงาน", href: "/admin/jobs" }, { label: job.title }]}
        actions={<Button variant="outline" asChild><Link href={`/admin/jobs/${job.job_id}/edit`}><Pencil /> แก้ไข</Link></Button>}
      />
      <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-5 py-4 shadow-xs">
        <JobStatusBadge status={job.status} expired={job.status === "open" && !isJobOpen(job)} />
        {job.department && <Meta icon={Building2}>{job.department}</Meta>}
        <Meta icon={Briefcase}>{EMPLOYMENT_TYPE_LABEL[job.employment_type]}</Meta>
        <Meta icon={MapPin}>{job.location}</Meta>
        <Meta icon={Wallet}>{formatSalaryRange(job.salary_min, job.salary_max)}</Meta>
        <Meta icon={Users}>รับ {job.headcount} คน</Meta>
        <Meta icon={CalendarClock}>ปิดรับ {job.closing_date ? formatDate(job.closing_date) : "ไม่กำหนด"}</Meta>
      </div>
      <h2 className="mb-3 text-base font-semibold text-foreground">ผู้สมัคร</h2>
      <JobPipeline jobId={job.job_id} />
    </>
  )
}
