"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, FileText, Folder, Inbox, Lock } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { localToday, showClosedNotice } from "@/lib/job-closed"
import type { Application, Interview } from "@/lib/types"
import { PublicShell } from "@/components/app/public-shell"
import { RequireRole } from "@/components/app/require-role"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/app/empty-state"
import { ErrorState, LoadingState } from "@/components/app/states"
import { StatusBadge } from "@/components/app/status-badge"
import { StatusStepper } from "@/components/app/status-stepper"
import { Button } from "@/components/ui/button"
import { DocumentsDialog, FormDialog } from "@/components/public/application-dialogs"

function nextInterview(appId: number, interviews: Interview[]): Interview | undefined {
  const t = localToday()
  return interviews
    .filter((i) => i.application_id === appId && i.status === "scheduled" && i.interview_date.slice(0, 10) >= t)
    .sort((a, b) => (a.interview_date + a.interview_time).localeCompare(b.interview_date + b.interview_time))[0]
}

function Content() {
  const [data, setData] = useState<{ apps: Application[]; interviews: Interview[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Application | null>(null)
  const [docs, setDocs] = useState<Application | null>(null)

  const fetchAll = () => Promise.all([api<Application[]>("/applications"), api<Interview[]>("/interviews")]).then(([apps, interviews]) => ({ apps, interviews }))
  const retry = useCallback(() => {
    setError(null)
    setData(null)
    fetchAll().then(setData).catch((e: Error) => setError(e.message))
  }, [])
  useEffect(() => {
    fetchAll().then(setData).catch((e: Error) => setError(e.message))
  }, [])
  // silent refresh when the tab regains focus/visibility so HR status changes show up; failures keep the current data
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") fetchAll().then(setData).catch(() => {})
    }
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener("focus", refresh)
    return () => {
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader title="ใบสมัครของฉัน" description="ติดตามสถานะใบสมัครและนัดสัมภาษณ์ของคุณ" />
      {error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : !data ? (
        <div className="space-y-4"><LoadingState rows={5} /><LoadingState rows={5} /></div>
      ) : data.apps.length === 0 ? (
        <EmptyState icon={Inbox} title="คุณยังไม่ได้สมัครงาน" text="เลือกตำแหน่งที่สนใจแล้วสมัครได้เลย"
          action={<Button asChild><Link href="/">ดูตำแหน่งงาน</Link></Button>} />
      ) : (
        <ul className="space-y-4">
          {[...data.apps].sort((a, b) => b.apply_date.localeCompare(a.apply_date)).map((a) => {
            const iv = a.status === "rejected" || a.status === "passed" ? undefined : nextInterview(a.application_id, data.interviews)
            return (
              <li key={a.application_id} className="rounded-xl border bg-card p-5 shadow-xs sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                      <Link href={`/jobs/${a.job_id}`} className="hover:text-indigo-700">{a.job_title ?? `ตำแหน่ง #${a.job_id}`}</Link>
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">สมัครเมื่อ {formatDate(a.apply_date)}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <StatusStepper status={a.status} className="mt-6 mb-1" />
                {showClosedNotice(a) && (
                  <div className="mt-5 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <Lock className="size-5 shrink-0 text-amber-600" />
                    <span>ปิดรับสมัครแล้ว · ใบสมัครของคุณยังอยู่ระหว่างการพิจารณา</span>
                  </div>
                )}
                {iv && (
                  <div className="mt-5 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <CalendarClock className="size-5 shrink-0 text-amber-600" />
                    <span>นัดสัมภาษณ์ <b>{formatDate(iv.interview_date)}</b> เวลา <b>{iv.interview_time.slice(0, 5)} น.</b></span>
                  </div>
                )}
                <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                  <Button variant="outline" size="sm" onClick={() => setForm(a)}><FileText /> ดูใบสมัคร</Button>
                  <Button variant="outline" size="sm" onClick={() => setDocs(a)}><Folder /> เอกสาร</Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <FormDialog app={form} onClose={() => setForm(null)} />
      <DocumentsDialog app={docs} onClose={() => setDocs(null)} />
    </div>
  )
}

export default function MyApplicationsPage() {
  return (
    <RequireRole role="applicant">
      <PublicShell>
        <Content />
      </PublicShell>
    </RequireRole>
  )
}
