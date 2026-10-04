"use client"

import { use, useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { Job } from "@/lib/types"
import { PageHeader } from "@/components/app/page-header"
import { LoadingState, ErrorState } from "@/components/app/states"
import { JobForm } from "@/components/admin/jobs/job-form"

export default function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <>
      <PageHeader title="แก้ไขตำแหน่งงาน" breadcrumb={[{ label: "ตำแหน่งงาน", href: "/admin/jobs" }, { label: job?.title ?? "แก้ไข" }]} />
      {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} />
        : !job ? <LoadingState rows={8} className="mx-auto max-w-3xl" />
        : <JobForm job={job} />}
    </>
  )
}
