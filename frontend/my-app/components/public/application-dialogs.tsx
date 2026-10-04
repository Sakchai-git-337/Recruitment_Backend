"use client"

import { useEffect, useState } from "react"
import { ExternalLink, FileText } from "lucide-react"
import { toast } from "sonner"
import { api, openDocument } from "@/lib/api"
import { formatBytes, formatDate } from "@/lib/format"
import { DOC_TYPE_LABEL, type Application, type ApplicationDocument } from "@/lib/types"
import { FormViewer } from "@/components/application/form-viewer"
import { EmptyState } from "@/components/app/empty-state"
import { ErrorState, LoadingState } from "@/components/app/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ApplicationForm } from "@/lib/application-form"

type Loaded<T> = { id: number; value?: T; error?: string }

/** fetches `path` whenever `app` changes; result is tagged with the app id so stale data is never shown */
function useLoad<T>(app: Application | null, path: (id: number) => string) {
  const [res, setRes] = useState<Loaded<T> | null>(null)
  const [attempt, setAttempt] = useState(0)
  const id = app?.application_id
  useEffect(() => {
    if (id == null) return
    let live = true
    api<T>(path(id))
      .then((value) => live && setRes({ id, value }))
      .catch((e: Error) => live && setRes({ id, error: e.message }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt])
  const cur = res && res.id === id ? res : null
  return { value: cur?.value, error: cur?.error, loading: id != null && !cur, retry: () => { setRes(null); setAttempt((n) => n + 1) } }
}

export function FormDialog({ app, onClose }: { app: Application | null; onClose: () => void }) {
  const { value, error, loading, retry } = useLoad<{ data: ApplicationForm; consent_at: string }>(app, (id) => `/applications/${id}/form`)
  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden bg-slate-50 p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b bg-white px-5 py-4 pr-12">
          <DialogTitle className="text-base">{app?.job_title ?? "ใบสมัครของฉัน"}</DialogTitle>
          <DialogDescription>{app && `สมัครเมื่อ ${formatDate(app.apply_date)}`}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {error ? <ErrorState message={error} onRetry={retry} />
            : loading || !value ? <LoadingState rows={8} />
            : <FormViewer data={value.data} consentAt={value.consent_at} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DocumentsDialog({ app, onClose }: { app: Application | null; onClose: () => void }) {
  const { value, error, loading, retry } = useLoad<ApplicationDocument[]>(app, (id) => `/applications/${id}/documents`)
  const open = (d: ApplicationDocument) =>
    openDocument(d.document_id, d.filename).catch(() => toast.error("เปิดเอกสารไม่สำเร็จ"))
  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>เอกสารที่แนบ</DialogTitle>
          <DialogDescription>{app?.job_title}</DialogDescription>
        </DialogHeader>
        {error ? <ErrorState message={error} onRetry={retry} />
          : loading || !value ? <LoadingState rows={3} />
          : value.length === 0 ? <EmptyState icon={FileText} title="ไม่มีเอกสารแนบ" />
          : (
            <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border">
              {value.map((d) => (
                <li key={d.document_id} className="flex items-center gap-3 p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><FileText className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</p>
                    <p className="truncate text-xs text-slate-500">{d.filename} · {formatBytes(d.size_bytes)} · {formatDate(d.uploaded_at)}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => open(d)}><ExternalLink /> เปิด</Button>
                </li>
              ))}
            </ul>
          )}
      </DialogContent>
    </Dialog>
  )
}
