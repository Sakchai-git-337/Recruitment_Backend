"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Briefcase, MoreHorizontal, Plus, Users, Pencil, Power, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { EMPLOYMENT_TYPE_LABEL, type Application, type Job } from "@/lib/types"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/app/empty-state"
import { LoadingState, ErrorState } from "@/components/app/states"
import { JobStatusBadge } from "@/components/app/status-badge"
import { isJobOpen } from "@/components/public/job-utils"
import { ConfirmDialog } from "@/components/app/confirm-dialog"

type Data = { jobs: Job[]; counts: Record<number, number> }

export default function AdminJobsPage() {
  const router = useRouter()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState("")
  const [tick, setTick] = useState(0)
  const [toDelete, setToDelete] = useState<Job | null>(null)

  useEffect(() => {
    let live = true
    Promise.all([api<Job[]>("/jobs"), api<Application[]>("/applications")])
      .then(([jobs, apps]) => {
        if (!live) return
        const counts: Record<number, number> = {}
        for (const a of apps) counts[a.job_id] = (counts[a.job_id] ?? 0) + 1
        setData({ jobs, counts })
        setError("")
      })
      .catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [tick])

  const reload = () => setTick((t) => t + 1)

  async function toggle(j: Job) {
    const status = j.status === "open" ? "closed" : "open"
    try {
      await api(`/jobs/${j.job_id}`, { method: "PATCH", body: { status } })
      toast.success(status === "open" ? "เปิดรับสมัครแล้ว" : "ปิดรับสมัครแล้ว")
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ")
    }
  }

  async function remove(j: Job) {
    try {
      await api(`/jobs/${j.job_id}`, { method: "DELETE" })
      toast.success("ลบตำแหน่งงานแล้ว")
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ")
      throw e
    }
  }

  const menu = (j: Job) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="จัดการ"><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => router.push(`/admin/jobs/${j.job_id}`)}><Users /> ดูผู้สมัคร</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(`/admin/jobs/${j.job_id}/edit`)}><Pencil /> แก้ไข</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toggle(j)}><Power /> {j.status === "open" ? "ปิดรับสมัคร" : "เปิดรับสมัคร"}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(j)}><Trash2 /> ลบ</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const create = (
    <Button asChild><Link href="/admin/jobs/new"><Plus /> สร้างตำแหน่งงาน</Link></Button>
  )

  return (
    <>
      <PageHeader title="ตำแหน่งงาน" description="จัดการตำแหน่งงานและติดตามจำนวนผู้สมัคร" actions={create} />
      {error ? <ErrorState message={error} onRetry={reload} />
        : !data ? <LoadingState rows={6} />
        : data.jobs.length === 0 ? <EmptyState icon={Briefcase} title="ยังไม่มีตำแหน่งงาน" text="สร้างตำแหน่งงานแรกเพื่อเริ่มรับสมัคร" action={create} />
        : (
          <>
            <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/70 hover:bg-muted/70">
                    <TableHead className="pl-5">ตำแหน่ง</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>สถานที่</TableHead>
                    <TableHead className="text-right">รับ</TableHead>
                    <TableHead className="text-right">ผู้สมัคร</TableHead>
                    <TableHead>ปิดรับ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="w-12 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.jobs.map((j) => (
                    <TableRow key={j.job_id}>
                      <TableCell className="pl-5">
                        <Link href={`/admin/jobs/${j.job_id}`} className="font-medium text-foreground hover:text-indigo-600 dark:hover:text-indigo-400">{j.title}</Link>
                        {j.department && <div className="text-xs text-muted-foreground">{j.department}</div>}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{EMPLOYMENT_TYPE_LABEL[j.employment_type]}</Badge></TableCell>
                      <TableCell className="text-foreground/70">{j.location}</TableCell>
                      <TableCell className="text-right tabular-nums text-foreground/70">{j.headcount}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/jobs/${j.job_id}`} className="font-medium tabular-nums text-indigo-600 dark:text-indigo-400 hover:underline">{data.counts[j.job_id] ?? 0}</Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-foreground/70">{j.closing_date ? formatDate(j.closing_date) : "ไม่กำหนด"}</TableCell>
                      <TableCell><JobStatusBadge status={j.status} expired={j.status === "open" && !isJobOpen(j)} /></TableCell>
                      <TableCell className="pr-4 text-right">{menu(j)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 md:hidden">
              {data.jobs.map((j) => (
                <div key={j.job_id} className="rounded-xl border bg-card p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/admin/jobs/${j.job_id}`} className="font-medium text-foreground">{j.title}</Link>
                      <div className="text-xs text-muted-foreground">{[j.department, j.location].filter(Boolean).join(" · ")}</div>
                    </div>
                    {menu(j)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <JobStatusBadge status={j.status} expired={j.status === "open" && !isJobOpen(j)} />
                    <Badge variant="secondary">{EMPLOYMENT_TYPE_LABEL[j.employment_type]}</Badge>
                  </div>
                  <div className="mt-3 flex justify-between border-t pt-3 text-xs text-muted-foreground">
                    <span>ผู้สมัคร <b className="text-foreground">{data.counts[j.job_id] ?? 0}</b> / รับ {j.headcount}</span>
                    <span>ปิดรับ {j.closing_date ? formatDate(j.closing_date) : "ไม่กำหนด"}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`ลบตำแหน่ง "${toDelete?.title ?? ""}"?`}
        description="การลบจะลบใบสมัคร เอกสาร และข้อมูลการคัดเลือกทั้งหมดของตำแหน่งนี้ด้วย และไม่สามารถกู้คืนได้"
        confirmLabel="ลบตำแหน่งงาน"
        destructive
        onConfirm={() => remove(toDelete!)}
      />
    </>
  )
}
