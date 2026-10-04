"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Inbox, Search } from "lucide-react"
import { api } from "@/lib/api"
import { APP_STATUSES, APP_STATUS_LABEL, type AppStatus, type Application, type Job } from "@/lib/types"
import { formatDate, initials } from "@/lib/format"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/app/empty-state"
import { ErrorState, LoadingState } from "@/components/app/states"
import { StatusBadge } from "@/components/app/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type Filter = AppStatus | "all"

function Person({ a }: { a: Application }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9 shrink-0"><AvatarFallback className="bg-indigo-50 dark:bg-indigo-500/10 text-xs font-medium text-indigo-700 dark:text-indigo-300">{initials(a.applicant_name ?? "?")}</AvatarFallback></Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{a.applicant_name ?? `ผู้สมัคร #${a.user_id}`}</p>
        <p className="truncate text-xs text-muted-foreground">{a.applicant_email}</p>
      </div>
    </div>
  )
}

export default function ApplicationsPage() {
  const router = useRouter()
  const [apps, setApps] = useState<Application[] | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [error, setError] = useState("")
  const [tick, setTick] = useState(0)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<Filter>("all")
  const [jobId, setJobId] = useState("all")

  useEffect(() => {
    Promise.all([api<Application[] | null>("/applications"), api<Job[] | null>("/jobs")])
      .then(([a, j]) => {
        setError("")
        setApps(a ?? [])
        setJobs(j ?? [])
      })
      .catch((e: Error) => setError(e.message))
  }, [tick])

  // counts follow the search + job filters so tab numbers match the rows shown
  const base = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (apps ?? []).filter(
      (a) =>
        (jobId === "all" || String(a.job_id) === jobId) &&
        (!s || `${a.applicant_name ?? ""} ${a.applicant_email ?? ""}`.toLowerCase().includes(s)),
    )
  }, [apps, q, jobId])
  const rows = status === "all" ? base : base.filter((a) => a.status === status)
  const count = (s: Filter) => (s === "all" ? base.length : base.filter((a) => a.status === s).length)
  const tabs: Filter[] = ["all", ...APP_STATUSES]

  return (
    <>
      <PageHeader title="ผู้สมัคร" description="ใบสมัครทั้งหมดในทุกตำแหน่ง" />
      {error ? (
        <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} />
      ) : !apps ? (
        <LoadingState rows={6} />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อหรืออีเมล" className="pl-9" aria-label="ค้นหา" />
            </div>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger className="w-full sm:w-64" aria-label="ตำแหน่ง"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกตำแหน่ง</SelectItem>
                {jobs.map((j) => <SelectItem key={j.job_id} value={String(j.job_id)}>{j.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="mb-4">
            <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t} type="button" role="tab" aria-selected={status === t} onClick={() => setStatus(t)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                    status === t ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "all" ? "ทั้งหมด" : APP_STATUS_LABEL[t]}
                  <span className="text-xs text-muted-foreground tabular-nums">{count(t)}</span>
                </button>
              ))}
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState icon={Inbox} title="ไม่พบใบสมัคร" text="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
          ) : (
            <>
              <div className="hidden rounded-xl border bg-card shadow-xs md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">ผู้สมัคร</TableHead>
                      <TableHead>ตำแหน่ง</TableHead>
                      <TableHead>วันที่สมัคร</TableHead>
                      <TableHead className="pr-5">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((a) => (
                      <TableRow key={a.application_id} className="cursor-pointer" onClick={() => router.push(`/admin/applications/${a.application_id}`)}>
                        <TableCell className="py-3 pl-5"><Person a={a} /></TableCell>
                        <TableCell className="text-foreground/80">{a.job_title ?? `#${a.job_id}`}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(a.apply_date)}</TableCell>
                        <TableCell className="pr-5"><StatusBadge status={a.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="space-y-3 md:hidden">
                {rows.map((a) => (
                  <li key={a.application_id}>
                    <Link href={`/admin/applications/${a.application_id}`} className="block rounded-xl border bg-card p-4 shadow-xs">
                      <Person a={a} />
                      <p className="mt-3 truncate text-sm text-foreground/80">{a.job_title ?? `#${a.job_id}`}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{formatDate(a.apply_date)}</span>
                        <StatusBadge status={a.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  )
}
