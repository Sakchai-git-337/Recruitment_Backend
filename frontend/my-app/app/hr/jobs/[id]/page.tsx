"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { api } from "@/lib/api"
import {
  APP_STATUSES,
  APP_STATUS_LABEL,
  JOB_STATUS_LABEL,
  groupByStatus,
  type AppStatus,
  type Application,
  type Job,
  type User,
} from "@/lib/types"
import { ErrorText, Loading } from "@/components/app-ui"

export default function JobKanbanPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [apps, setApps] = useState<Application[]>([])
  const [users, setUsers] = useState<Map<number, User>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [over, setOver] = useState<AppStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api<Job>(`/jobs/${id}`),
      api<Application[] | null>(`/applications?job_id=${id}`),
      api<User[] | null>("/users"),
    ])
      .then(([j, a, u]) => {
        if (cancelled) return
        setJob(j)
        setApps(a ?? [])
        setUsers(new Map((u ?? []).map((x) => [x.user_id, x])))
        setError("")
        setLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const groups = useMemo(() => groupByStatus(apps), [apps])

  async function move(app: Application, status: AppStatus) {
    if (app.status === status) return
    const prev = app.status
    setApps((list) => list.map((a) => (a.application_id === app.application_id ? { ...a, status } : a)))
    setError("")
    try {
      await api(`/applications/${app.application_id}`, { method: "PATCH", body: { status, note: app.note } })
    } catch (e) {
      setApps((list) => list.map((a) => (a.application_id === app.application_id ? { ...a, status: prev } : a)))
      setError((e as Error).message)
    }
  }

  if (loading) return <Loading />
  if (!job) return <ErrorText message={error} />

  return (
    <div className="space-y-4">
      <div>
        <Link href="/hr/jobs" className="text-sm text-gray-500 hover:text-gray-900">
          ← ตำแหน่งงาน
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{job.title}</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
            {JOB_STATUS_LABEL[job.status]}
          </span>
        </div>
        <p className="text-sm text-gray-500">{job.location}</p>
      </div>
      <ErrorText message={error} />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {APP_STATUSES.map((status) => (
          <section
            key={status}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(status)
            }}
            onDragLeave={() => setOver((o) => (o === status ? null : o))}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              const app = apps.find((a) => String(a.application_id) === e.dataTransfer.getData("text/plain"))
              if (app) move(app, status)
            }}
            className={`w-64 shrink-0 rounded-xl bg-gray-100 p-2 ${over === status ? "ring-2 ring-sky-300" : ""}`}
          >
            <h2 className="mb-2 flex justify-between px-1 text-sm font-medium">
              {APP_STATUS_LABEL[status]}
              <span className="text-gray-500">{groups[status].length}</span>
            </h2>
            <div className="space-y-2">
              {groups[status].length === 0 && <p className="px-1 text-xs text-gray-400">ไม่มีผู้สมัคร</p>}
              {groups[status].map((app) => {
                const u = users.get(app.user_id)
                return (
                  <div
                    key={app.application_id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(app.application_id))}
                    onDragEnd={() => setOver(null)}
                    className="space-y-1 rounded-lg border bg-white p-3 text-sm shadow-sm"
                  >
                    <Link href={`/hr/applications/${app.application_id}`} className="font-medium hover:underline">
                      {u?.full_name ?? `ผู้สมัคร #${app.user_id}`}
                    </Link>
                    {u?.email && <p className="truncate text-xs text-gray-500">{u.email}</p>}
                    <p className="text-xs text-gray-400">{app.apply_date?.slice(0, 10)}</p>
                    {app.note && <p className="line-clamp-2 text-xs text-gray-600">{app.note}</p>}
                    <select
                      aria-label="เปลี่ยนสถานะ"
                      value={app.status}
                      onChange={(e) => move(app, e.target.value as AppStatus)}
                      className="w-full rounded border border-gray-200 bg-white px-1 py-0.5 text-xs"
                    >
                      {APP_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {APP_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
