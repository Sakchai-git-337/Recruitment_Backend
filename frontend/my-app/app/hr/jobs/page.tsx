"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api, useUser } from "@/lib/api"
import {
  APP_STATUSES,
  APP_STATUS_COLOR,
  APP_STATUS_LABEL,
  JOB_STATUS_LABEL,
  countByStatus,
  type Application,
  type Job,
} from "@/lib/types"
import { ErrorText, Loading, inputClass } from "@/components/app-ui"
import { Button } from "@/components/ui/button"

type Form = Omit<Job, "job_id" | "created_by">
const emptyForm: Form = { title: "", location: "", description: "", requirement: "", status: "open" }

export default function HrJobsPage() {
  const user = useUser()
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [apps, setApps] = useState<Application[]>([])
  const [error, setError] = useState("")
  const [tick, setTick] = useState(0)
  const [editing, setEditing] = useState<Job | "new" | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [busy, setBusy] = useState(false)

  const reload = () => setTick((t) => t + 1)

  useEffect(() => {
    Promise.all([api<Job[] | null>("/jobs"), api<Application[] | null>("/applications")])
      .then(([j, a]) => {
        setJobs(j ?? [])
        setApps(a ?? [])
      })
      .catch((e: Error) => {
        setJobs((prev) => prev ?? [])
        setError(e.message)
      })
  }, [tick])

  function openForm(job?: Job) {
    setError("")
    setEditing(job ?? "new")
    setForm(job ? { title: job.title, location: job.location, description: job.description, requirement: job.requirement, status: job.status } : emptyForm)
  }

  async function mutate(fn: () => Promise<unknown>, after?: () => void) {
    setError("")
    setBusy(true)
    try {
      await fn()
      after?.()
      reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    if (editing === "new") {
      if (!user) return
      return mutate(() => api("/jobs", { method: "POST", body: { ...form, created_by: user.user_id } }), () => setEditing(null))
    }
    const job = editing
    return mutate(
      () => api(`/jobs/${job.job_id}`, { method: "PATCH", body: { ...form, created_by: job.created_by } }),
      () => setEditing(null),
    )
  }

  function toggle(job: Job) {
    const { job_id, ...rest } = job
    return mutate(() =>
      api(`/jobs/${job_id}`, { method: "PATCH", body: { ...rest, status: job.status === "open" ? "closed" : "open" } }),
    )
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value })

  if (jobs === null) return <Loading />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">ตำแหน่งงาน</h1>
        <Button onClick={() => openForm()}>สร้างตำแหน่งงาน</Button>
      </div>
      <ErrorText message={error} />

      {editing && (
        <form onSubmit={save} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="block text-sm">
            ชื่อตำแหน่ง
            <input required className={inputClass} value={form.title} onChange={set("title")} />
          </label>
          <label className="block text-sm">
            สถานที่
            <input required className={inputClass} value={form.location} onChange={set("location")} />
          </label>
          <label className="block text-sm">
            รายละเอียดงาน
            <textarea required rows={3} className={inputClass} value={form.description} onChange={set("description")} />
          </label>
          <label className="block text-sm">
            คุณสมบัติ
            <textarea required rows={3} className={inputClass} value={form.requirement} onChange={set("requirement")} />
          </label>
          <label className="block text-sm">
            สถานะ
            <select required className={inputClass} value={form.status} onChange={set("status")}>
              {(["open", "closed"] as const).map((s) => (
                <option key={s} value={s}>
                  {JOB_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              บันทึก
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              ยกเลิก
            </Button>
          </div>
        </form>
      )}

      {jobs.length === 0 ? (
        error ? null : (
        <p className="text-sm text-gray-500">ยังไม่มีตำแหน่งงาน</p>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => {
            const counts = countByStatus(apps.filter((a) => a.job_id === job.job_id))
            return (
              <div key={job.job_id} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/hr/jobs/${job.job_id}`} className="font-medium break-words hover:underline">
                      {job.title}
                    </Link>
                    <p className="text-sm text-gray-500">{job.location}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${job.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                  >
                    {JOB_STATUS_LABEL[job.status]}
                  </span>
                </div>
                <Button asChild className="w-full">
                  <Link href={`/hr/jobs/${job.job_id}`}>ผู้สมัครใหม่ {counts.pending}</Link>
                </Button>
                <div className="flex flex-wrap gap-1.5">
                  {APP_STATUSES.map((s) => (
                    <span key={s} className={`rounded-full px-2 py-0.5 text-xs ${APP_STATUS_COLOR[s]}`}>
                      {APP_STATUS_LABEL[s]} {counts[s]}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openForm(job)}>
                    แก้ไข
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => toggle(job)}>
                    {job.status === "open" ? "ปิดรับ" : "เปิดรับ"}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
