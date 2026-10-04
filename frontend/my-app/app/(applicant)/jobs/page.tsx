"use client"

import { useEffect, useState } from "react"
import { api, useUser } from "@/lib/api"
import type { Application, Job } from "@/lib/types"
import { ErrorText, inputClass, Loading } from "@/components/app-ui"
import { Button } from "@/components/ui/button"

export default function JobsPage() {
  const me = useUser()
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [tick, setTick] = useState(0)
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [applied, setApplied] = useState<Set<number>>(new Set())
  const [error, setError] = useState("")
  const [busyJobId, setBusyJobId] = useState<number | null>(null)
  const reload = () => setTick((t) => t + 1)
  const uid = me?.user_id

  useEffect(() => {
    if (uid === undefined) return
    let live = true
    Promise.all([
      api<Job[] | null>(`/jobs?search=${encodeURIComponent(q)}`),
      api<Application[] | null>(`/applications?user_id=${uid}`),
    ])
      .then(([j, a]) => {
        if (!live) return
        setJobs((j ?? []).filter((x) => x.status === "open"))
        setApplied(new Set((a ?? []).map((x) => x.job_id)))
        setError("")
      })
      .catch((e: Error) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [uid, q, tick])

  async function apply(jobId: number) {
    if (!me) return
    setError("")
    setBusyJobId(jobId)
    try {
      await api("/applications", { method: "POST", body: { user_id: me.user_id, job_id: jobId, status: "pending", note: "" } })
      setApplied((prev) => new Set(prev).add(jobId)) // block re-click until refetch lands
      reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyJobId(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">ตำแหน่งงานที่เปิดรับ</h1>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setQ(input.trim())
        }}
      >
        <input className={inputClass} value={input} onChange={(e) => setInput(e.target.value)} placeholder="ค้นหาตำแหน่งงาน" />
        <Button type="submit">ค้นหา</Button>
      </form>
      <ErrorText message={error} />
      {jobs === null ? (
        error ? null : <Loading />
      ) : jobs.length === 0 ? (
        <p className="text-sm text-gray-500">ไม่พบงานที่เปิดรับ</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {jobs.map((j) => (
            <div key={j.job_id} className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">{j.title}</h2>
              <p className="text-sm text-gray-500">{j.location}</p>
              <p className="text-sm">{j.description}</p>
              <p className="whitespace-pre-line text-sm text-gray-600">{j.requirement}</p>
              <Button disabled={applied.has(j.job_id) || busyJobId === j.job_id} onClick={() => apply(j.job_id)}>
                {applied.has(j.job_id) ? "สมัครแล้ว" : "สมัคร"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
