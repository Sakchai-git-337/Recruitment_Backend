"use client"

import { useCallback, useEffect, useState } from "react"
import { Search, SearchX } from "lucide-react"
import { api } from "@/lib/api"
import { EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABEL, type Job } from "@/lib/types"
import { PublicShell } from "@/components/app/public-shell"
import { EmptyState } from "@/components/app/empty-state"
import { ErrorState } from "@/components/app/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { JobCard } from "@/components/public/job-card"
import { isJobOpen } from "@/components/public/job-utils"

const ALL = "all"

function Filter({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full bg-card sm:w-48" aria-label={placeholder}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

const fetchOpenJobs = () => api<Job[]>("/jobs").then((j) => j.filter((x) => isJobOpen(x)))

export default function Home() {
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [dept, setDept] = useState(ALL)
  const [type, setType] = useState(ALL)
  const [loc, setLoc] = useState(ALL)

  const retry = useCallback(() => {
    setError(null)
    setJobs(null)
    fetchOpenJobs().then(setJobs).catch((e: Error) => setError(e.message))
  }, [])
  useEffect(() => {
    fetchOpenJobs().then(setJobs).catch((e: Error) => setError(e.message))
  }, [])

  const uniq = (f: (j: Job) => string) =>
    [...new Set((jobs ?? []).map(f).filter(Boolean))].sort().map((v) => ({ value: v, label: v }))

  const s = q.trim().toLowerCase()
  const shown = (jobs ?? []).filter(
    (j) =>
      (!s || [j.title, j.department, j.location, j.description].some((t) => t.toLowerCase().includes(s))) &&
      (dept === ALL || j.department === dept) &&
      (type === ALL || j.employment_type === type) &&
      (loc === ALL || j.location === loc),
  )
  const filtering = !!s || dept !== ALL || type !== ALL || loc !== ALL
  const reset = () => { setQ(""); setDept(ALL); setType(ALL); setLoc(ALL) }

  return (
    <PublicShell>
      <section className="border-b bg-gradient-to-b from-indigo-50 via-indigo-50/40 to-muted/40 dark:from-indigo-500/15 dark:via-indigo-500/5 dark:to-background">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="mb-3 inline-flex rounded-full border border-indigo-100 dark:border-indigo-500/30 bg-card px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
            กำลังเปิดรับสมัคร
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">ร่วมงานกับเรา</h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">ค้นหาตำแหน่งงานที่ใช่ แล้วสมัครออนไลน์ได้ในไม่กี่ขั้นตอน</p>
          <div className="relative mt-8 max-w-xl">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาตำแหน่งงาน แผนก หรือสถานที่"
              aria-label="ค้นหาตำแหน่งงาน" className="h-12 rounded-xl bg-card pl-12 text-base shadow-sm"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Filter value={dept} onChange={setDept} placeholder="ทุกแผนก" options={uniq((j) => j.department)} />
            <Filter value={type} onChange={setType} placeholder="ทุกประเภทงาน"
              options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: EMPLOYMENT_TYPE_LABEL[t] }))} />
            <Filter value={loc} onChange={setLoc} placeholder="ทุกสถานที่" options={uniq((j) => j.location)} />
          </div>
          {jobs && <p className="text-sm text-muted-foreground">พบ {shown.length} ตำแหน่ง</p>}
        </div>

        {error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : !jobs ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={filtering ? "ไม่พบตำแหน่งที่ตรงกับการค้นหา" : "ยังไม่มีตำแหน่งที่เปิดรับสมัคร"}
            text={filtering ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "โปรดกลับมาตรวจสอบใหม่ภายหลัง"}
            action={filtering ? <Button variant="outline" onClick={reset}>ล้างตัวกรอง</Button> : undefined}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((j) => <JobCard key={j.job_id} job={j} />)}
          </div>
        )}
      </div>
    </PublicShell>
  )
}
