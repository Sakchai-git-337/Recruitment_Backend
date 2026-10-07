"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { Calendar, Download, FileText, Mail, Phone, Printer, Briefcase } from "lucide-react"
import { api, ApiError, openDocument } from "@/lib/api"
import {
  DOC_TYPE_LABEL,
  type AppStatus, type Application, type ApplicationDocument, type Interview, type Screening, type WorkTest,
} from "@/lib/types"
import { formatBytes, formatDate, initials } from "@/lib/format"
import { PageHeader } from "@/components/app/page-header"
import { StatusStepper } from "@/components/app/status-stepper"
import { StatusBadge } from "@/components/app/status-badge"
import { EmptyState } from "@/components/app/empty-state"
import { ErrorState, LoadingState } from "@/components/app/states"
import { FormViewer } from "@/components/application/form-viewer"
import { SelectionPanel, type Run } from "@/components/admin/applications/selection-panel"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Form = { data: Record<string, unknown>; consent_at: string }
type Data = {
  app: Application
  form: Form | null
  docs: ApplicationDocument[]
  screenings: Screening[]
  interviews: Interview[]
  workTests: WorkTest[]
}

/** 404 = the application simply has no form (e.g. created by HR) */
const optional = <T,>(p: Promise<T>): Promise<T | null> =>
  p.catch((e) => { if (e instanceof ApiError && e.status === 404) return null; throw e })

const tabClass = "after:hidden rounded-none border-x-0 border-t-0 border-b-2 border-transparent px-3 pb-3 text-sm data-active:border-indigo-600 data-active:text-indigo-700 dark:data-active:text-indigo-300"

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  // unsaved note text, tied to the application it was typed for (a status change reloads but keeps it)
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null)
  const note = draft?.id === id ? draft.text : null
  const setNote = (text: string) => setDraft({ id, text })
  const [tab, setTab] = useState("form")
  const reload = () => setTick((t) => t + 1)

  useEffect(() => {
    Promise.all([
      api<Application>(`/applications/${id}`),
      optional(api<Form>(`/applications/${id}/form`)),
      api<ApplicationDocument[] | null>(`/applications/${id}/documents`),
      api<Screening[] | null>(`/screenings?application_id=${id}`),
      api<Interview[] | null>(`/interviews?application_id=${id}`),
      api<WorkTest[] | null>(`/work-tests?application_id=${id}`),
    ])
      .then(([app, form, docs, s, i, w]) => {
        setError("")
        setData({ app, form, docs: docs ?? [], screenings: s ?? [], interviews: i ?? [], workTests: w ?? [] })
      })
      .catch((e: Error) => setError(e.message))
  }, [id, tick])

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState rows={8} />

  const { app } = data
  const run: Run = async (fn, okMsg) => {
    setBusy(true)
    try {
      await fn()
      toast.success(okMsg)
      reload()
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }
  const noteValue = note ?? app.note
  const name = app.applicant_name ?? `ผู้สมัคร #${app.user_id}`

  return (
    <>
      <PageHeader
        className="print:hidden"
        breadcrumb={[{ label: "ผู้สมัคร", href: "/admin/applications" }, { label: name }]}
        title={name}
        description={app.job_title ?? `ตำแหน่ง #${app.job_id}`}
      />

      <div className="rounded-xl border bg-card p-5 shadow-xs print:hidden">
        <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
          <StatusBadge status={app.status} className="lg:order-last" />
          <div className="flex items-center gap-4">
            <Avatar className="size-14"><AvatarFallback className="bg-indigo-50 dark:bg-indigo-500/10 text-lg font-medium text-indigo-700 dark:text-indigo-300">{initials(name)}</AvatarFallback></Avatar>
            <dl className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
              <Meta icon={Mail} v={app.applicant_email} />
              <Meta icon={Phone} v={app.applicant_phone} />
              <Meta icon={Briefcase} v={app.job_title ?? `#${app.job_id}`} />
              <Meta icon={Calendar} v={`สมัครเมื่อ ${formatDate(app.apply_date)}`} />
            </dl>
          </div>
        </div>
        <div className="mt-6 border-t pt-5">
          <StatusStepper
            status={app.status} rejectedFrom={app.rejected_from} disabled={busy}
            onChange={(s: AppStatus) => s !== app.status && run(() => api(`/applications/${id}`, { method: "PATCH", body: { status: s } }), "อัปเดตสถานะแล้ว")}
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6 gap-5">
        <div className="flex items-end justify-between gap-3 border-b print:hidden">
          <div className="-mb-px overflow-x-auto">
            <TabsList variant="line" className="h-auto gap-1 p-0">
              <TabsTrigger value="form" className={tabClass}>ใบสมัคร</TabsTrigger>
              <TabsTrigger value="docs" className={tabClass}>เอกสาร{data.docs.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{data.docs.length}</span>}</TabsTrigger>
              <TabsTrigger value="selection" className={tabClass}>การคัดเลือก</TabsTrigger>
              <TabsTrigger value="note" className={tabClass}>บันทึก</TabsTrigger>
            </TabsList>
          </div>
          {tab === "form" && data.form && (
            <Button type="button" variant="outline" size="sm" className="mb-2 hidden shrink-0 sm:inline-flex" onClick={() => window.print()}>
              <Printer className="size-4" />พิมพ์
            </Button>
          )}
        </div>

        <TabsContent value="form">
          {data.form ? (
            <>
              <div className="mb-4 hidden print:block">
                <h1 className="text-xl font-semibold">ใบสมัครงาน: {name}</h1>
                <p className="text-sm text-foreground/70">{app.job_title} · สมัครเมื่อ {formatDate(app.apply_date)}</p>
              </div>
              <FormViewer data={data.form.data} consentAt={data.form.consent_at} />
            </>
          ) : (
            <EmptyState icon={FileText} title="ไม่มีใบสมัครแบบออนไลน์" text="ใบสมัครนี้ถูกสร้างโดยไม่มีแบบฟอร์ม" />
          )}
        </TabsContent>

        <TabsContent value="docs" className="print:hidden">
          {data.docs.length === 0 ? (
            <EmptyState icon={FileText} title="ยังไม่มีเอกสาร" text="ผู้สมัครไม่ได้แนบเอกสาร" />
          ) : (
            <ul className="divide-y rounded-xl border bg-card shadow-xs">
              {data.docs.map((d) => (
                <li key={d.document_id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"><FileText className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.filename} · {formatBytes(d.size_bytes)}</p>
                  </div>
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => openDocument(d.document_id, d.filename).catch((e: Error) => toast.error(e.message))}
                  >
                    <Download className="size-4" /><span className="hidden sm:inline">เปิดไฟล์</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="selection" className="print:hidden">
          <SelectionPanel appId={app.application_id} screenings={data.screenings} interviews={data.interviews} workTests={data.workTests} run={run} busy={busy} />
        </TabsContent>

        <TabsContent value="note" className="print:hidden">
          <div className="rounded-xl border bg-card p-5 shadow-xs">
            <h3 className="font-semibold text-foreground">บันทึกภายใน</h3>
            <p className="mt-1 text-sm text-muted-foreground">ผู้สมัครไม่เห็นข้อความนี้</p>
            <Textarea className="mt-4" rows={6} value={noteValue} onChange={(e) => setNote(e.target.value)} aria-label="บันทึกภายใน" />
            <div className="mt-4 flex justify-end">
              <Button type="button" disabled={busy || note === null || note === app.note} onClick={() => run(() => api(`/applications/${id}`, { method: "PATCH", body: { note: noteValue } }), "บันทึกแล้ว")}>
                บันทึก
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}

function Meta({ icon: Icon, v }: { icon: typeof Mail; v?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-foreground/70">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{v || "-"}</span>
    </div>
  )
}
