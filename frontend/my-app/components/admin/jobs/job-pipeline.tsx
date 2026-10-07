"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ChevronDown, Lock, Users } from "lucide-react"
import { api } from "@/lib/api"
import { APP_STATUSES, APP_STATUS_LABEL, groupByStatus, type AppStatus, type Application } from "@/lib/types"
import { formatDate, initials } from "@/lib/format"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/app/empty-state"
import { LoadingState, ErrorState } from "@/components/app/states"

const DOT: Record<AppStatus, string> = {
  pending: "bg-slate-400", screening: "bg-sky-500", interview: "bg-amber-500", probation: "bg-teal-500", passed: "bg-emerald-500", rejected: "bg-red-500",
}

export function JobPipeline({ jobId, hasProbation }: { jobId: number; hasProbation: boolean }) {
  const [apps, setApps] = useState<Application[] | null>(null)
  const [error, setError] = useState("")
  const [tick, setTick] = useState(0)
  const [locked, setLocked] = useState<Set<number>>(new Set())
  const [dragId, setDragId] = useState<number | null>(null)
  const [over, setOver] = useState<AppStatus | null>(null)

  useEffect(() => {
    let live = true
    api<Application[]>(`/applications?job_id=${jobId}`)
      .then((a) => { if (live) { setApps(a); setError("") } })
      .catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [jobId, tick])

  function setStatus(id: number, status: AppStatus) {
    setApps((p) => p && p.map((a) => (a.application_id === id ? { ...a, status } : a)))
  }

  async function move(app: Application, to: AppStatus) {
    const from = app.status
    if (from === to || locked.has(app.application_id)) return
    const id = app.application_id
    setStatus(id, to) // optimistic
    setLocked((s) => new Set(s).add(id))
    try {
      await api(`/applications/${id}`, { method: "PATCH", body: { status: to } })
      toast.success(`ย้ายไป "${APP_STATUS_LABEL[to]}" แล้ว`)
    } catch (e) {
      setStatus(id, from) // rollback
      toast.error(e instanceof Error ? e.message : "ย้ายสถานะไม่สำเร็จ")
    } finally {
      setLocked((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} />
  if (!apps) return <LoadingState rows={6} />
  if (apps.length === 0) return <EmptyState icon={Users} title="ยังไม่มีผู้สมัคร" text="เมื่อมีผู้สมัครตำแหน่งนี้ จะแสดงที่นี่" />

  const groups = groupByStatus(apps)
  // no probation column for jobs without it, unless someone is still sitting in it
  const statuses = APP_STATUSES.filter((s) => s !== "probation" || hasProbation || groups.probation.length > 0)

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-max grid-flow-col auto-cols-[16rem] gap-4 xl:min-w-0 xl:auto-cols-fr">
        {statuses.map((s) => (
          <section
            key={s}
            aria-label={APP_STATUS_LABEL[s]}
            onDragOver={(e) => { e.preventDefault(); setOver(s) }}
            onDragLeave={() => setOver((o) => (o === s ? null : o))}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              const app = apps.find((a) => a.application_id === dragId)
              if (app) void move(app, s)
              setDragId(null)
            }}
            className={cn(
              "flex min-h-48 flex-col rounded-xl border bg-muted/70 p-2.5 transition-colors",
              over === s && "border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10",
            )}
          >
            <header className="mb-2.5 flex items-center gap-2 px-1.5 pt-1 text-sm font-medium text-foreground/80">
              <span className={cn("size-2 rounded-full", DOT[s])} />
              {APP_STATUS_LABEL[s]}
              <span className="ml-auto rounded-full bg-card px-2 text-xs tabular-nums text-muted-foreground shadow-xs">{groups[s].length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-2.5">
              {groups[s].map((a) => {
                const isLocked = locked.has(a.application_id)
                return (
                  <article
                    key={a.application_id}
                    draggable={!isLocked}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(a.application_id)); setDragId(a.application_id) }}
                    onDragEnd={() => { setDragId(null); setOver(null) }}
                    aria-busy={isLocked}
                    className={cn(
                      "rounded-lg border bg-card p-3 shadow-xs transition",
                      isLocked ? "opacity-60" : "cursor-grab hover:shadow-sm active:cursor-grabbing",
                      dragId === a.application_id && "opacity-40",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                        {initials(a.applicant_name || "?")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/applications/${a.application_id}`} className="block truncate text-sm font-medium text-foreground hover:text-indigo-600 dark:hover:text-indigo-400">
                          {a.applicant_name || "ไม่ระบุชื่อ"}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">สมัคร {formatDate(a.apply_date)}</p>
                      </div>
                      {isLocked && <Lock className="size-3.5 text-muted-foreground" />}
                    </div>
                    <div className="relative mt-3">
                    <select
                      aria-label={`ย้ายสถานะของ ${a.applicant_name ?? ""}`}
                      value={a.status}
                      disabled={isLocked}
                      onChange={(e) => void move(a, e.target.value as AppStatus)}
                      className="h-9 w-full appearance-none rounded-lg border border-input bg-transparent pr-8 pl-3 text-sm text-foreground/80 shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {statuses.map((x) => <option key={x} value={x}>{APP_STATUS_LABEL[x]}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </article>
                )
              })}
              {groups[s].length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">ไม่มีผู้สมัคร</p>}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
