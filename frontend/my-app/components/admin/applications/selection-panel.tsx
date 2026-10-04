"use client"

import { useState, type ReactNode } from "react"
import { ClipboardCheck, ListChecks, Plus, Trash2, Users } from "lucide-react"
import { api } from "@/lib/api"
import {
  INTERVIEW_STATUS_LABEL, RESULT_LABEL,
  type Interview, type InterviewStatus, type Result, type Screening, type WorkTest,
} from "@/lib/types"
import { formatDate } from "@/lib/format"
import { FormField } from "@/components/app/form-field"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** runs a mutation with busy flag + toast + reload; resolves true on success */
export type Run = (fn: () => Promise<unknown>, okMsg: string) => Promise<boolean>
type P = { run: Run; busy: boolean }

const day = (s: string) => s.slice(0, 10)
const time = (s: string) => s.slice(0, 5)

function Pick<T extends string>({ value, onChange, labels, label }: { value: T; onChange: (v: T) => void; labels: Record<T, string>; label: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className="w-full" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        {(Object.keys(labels) as T[]).map((k) => <SelectItem key={k} value={k}>{labels[k]}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function Section({ title, icon: Icon, empty, list, form }: { title: string; icon: typeof Users; empty: string; list: ReactNode[]; form: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card shadow-xs">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"><Icon className="size-4" /></span>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/70 tabular-nums">{list.length}</span>
      </div>
      <div className="space-y-3 p-5">
        {list.length === 0 ? <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">{empty}</p> : list}
      </div>
      <div className="rounded-b-xl border-t bg-muted/60 p-5">{form}</div>
    </section>
  )
}

/** one saved item: editable fields + save/delete (delete asks for confirmation) */
function Row({ children, onSave, onDelete, busy, canSave = true, meta }: {
  children: ReactNode; onSave: () => void; onDelete: () => Promise<boolean>; busy: boolean; canSave?: boolean; meta?: ReactNode
}) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="rounded-lg border bg-card p-4">
      {meta && <p className="mb-3 text-xs font-medium text-muted-foreground">{meta}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300" disabled={busy} onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" />ลบ
        </Button>
        <Button type="button" size="sm" disabled={busy || !canSave} onClick={onSave}>บันทึก</Button>
      </div>
      <ConfirmDialog
        open={confirm} onOpenChange={setConfirm} title="ลบรายการนี้?" description="การลบไม่สามารถย้อนกลับได้"
        confirmLabel="ลบ" destructive
        onConfirm={async () => { if (!(await onDelete())) throw new Error("delete failed") }}
      />
    </div>
  )
}

function ScreeningRow({ s, run, busy }: { s: Screening } & P) {
  const [result, setResult] = useState<Result>(s.result)
  const [note, setNote] = useState(s.note)
  return (
    <Row
      busy={busy} meta={formatDate(s.screening_date)}
      onSave={() => run(() => api(`/screenings/${s.screening_id}`, { method: "PATCH", body: { result, note } }), "บันทึกแล้ว")}
      onDelete={() => run(() => api(`/screenings/${s.screening_id}`, { method: "DELETE" }), "ลบแล้ว")}
    >
      <FormField label="ผล"><Pick label="ผล" value={result} onChange={setResult} labels={RESULT_LABEL} /></FormField>
      <FormField label="หมายเหตุ" className="lg:col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
    </Row>
  )
}

function InterviewRow({ i, run, busy }: { i: Interview } & P) {
  const [date, setDate] = useState(day(i.interview_date))
  const [t, setT] = useState(time(i.interview_time))
  const [status, setStatus] = useState<InterviewStatus>(i.status)
  const [result, setResult] = useState(i.result)
  const [note, setNote] = useState(i.note)
  return (
    <Row
      busy={busy} canSave={!!date && !!t}
      onSave={() => run(() => api(`/interviews/${i.interview_id}`, { method: "PATCH", body: { interview_date: date, interview_time: t, status, result, note } }), "บันทึกแล้ว")}
      onDelete={() => run(() => api(`/interviews/${i.interview_id}`, { method: "DELETE" }), "ลบแล้ว")}
    >
      <FormField label="วันที่"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
      <FormField label="เวลา"><Input type="time" value={t} onChange={(e) => setT(e.target.value)} /></FormField>
      <FormField label="สถานะ"><Pick label="สถานะ" value={status} onChange={setStatus} labels={INTERVIEW_STATUS_LABEL} /></FormField>
      <FormField label="ผลสัมภาษณ์"><Input value={result} onChange={(e) => setResult(e.target.value)} /></FormField>
      <FormField label="หมายเหตุ" className="lg:col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
    </Row>
  )
}

function WorkTestRow({ w, run, busy }: { w: WorkTest } & P) {
  const [result, setResult] = useState((w.test_result || "pending") as Result)
  const [note, setNote] = useState(w.test_note)
  return (
    <Row
      busy={busy} meta={`วันที่ทดสอบ ${formatDate(w.test_date)}`}
      onSave={() => run(() => api(`/work-tests/${w.test_id}`, { method: "PATCH", body: { test_result: result, test_note: note } }), "บันทึกแล้ว")}
      onDelete={() => run(() => api(`/work-tests/${w.test_id}`, { method: "DELETE" }), "ลบแล้ว")}
    >
      <FormField label="ผล"><Pick label="ผล" value={result} onChange={setResult} labels={RESULT_LABEL} /></FormField>
      <FormField label="หมายเหตุ" className="lg:col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
    </Row>
  )
}

function AddForm({ children, onSubmit, busy, label }: { children: ReactNode; onSubmit: () => Promise<boolean>; busy: boolean; label: string }) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void onSubmit() }}
      className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {children}
      <Button type="submit" disabled={busy} className="w-full sm:w-auto sm:justify-self-start"><Plus className="size-4" />{label}</Button>
    </form>
  )
}

function AddScreening({ appId, run, busy }: { appId: number } & P) {
  const [result, setResult] = useState<Result>("pending")
  const [note, setNote] = useState("")
  return (
    <AddForm busy={busy} label="เพิ่มการคัดกรอง" onSubmit={() =>
      run(() => api("/screenings", { method: "POST", body: { application_id: appId, result, note } }), "เพิ่มการคัดกรองแล้ว").then((ok) => { if (ok) setNote(""); return ok })}>
      <FormField label="ผล"><Pick label="ผล" value={result} onChange={setResult} labels={RESULT_LABEL} /></FormField>
      <FormField label="หมายเหตุ" className="lg:col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
    </AddForm>
  )
}

function AddInterview({ appId, run, busy }: { appId: number } & P) {
  const [date, setDate] = useState("")
  const [t, setT] = useState("")
  const [note, setNote] = useState("")
  return (
    <AddForm busy={busy} label="นัดสัมภาษณ์" onSubmit={() =>
      run(() => api("/interviews", { method: "POST", body: { application_id: appId, interview_date: date, interview_time: t, status: "scheduled", result: "", note } }), "นัดสัมภาษณ์แล้ว")
        .then((ok) => { if (ok) { setDate(""); setT(""); setNote("") } return ok })}>
      <FormField label="วันที่" required><Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
      <FormField label="เวลา" required><Input type="time" required value={t} onChange={(e) => setT(e.target.value)} /></FormField>
      <FormField label="หมายเหตุ"><Input value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
    </AddForm>
  )
}

function AddWorkTest({ appId, run, busy }: { appId: number } & P) {
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")
  return (
    <AddForm busy={busy} label="มอบหมายแบบทดสอบ" onSubmit={() =>
      run(() => api("/work-tests", { method: "POST", body: { application_id: appId, test_date: new Date(date + "T00:00").toISOString(), test_result: "pending", test_note: note } }), "มอบหมายแบบทดสอบแล้ว")
        .then((ok) => { if (ok) { setDate(""); setNote("") } return ok })}>
      <FormField label="วันที่ทดสอบ" required><Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
      <FormField label="หมายเหตุ" className="lg:col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
    </AddForm>
  )
}

export function SelectionPanel({ appId, screenings, interviews, workTests, run, busy }: {
  appId: number; screenings: Screening[]; interviews: Interview[]; workTests: WorkTest[]
} & P) {
  const p = { run, busy }
  return (
    <div className="space-y-6">
      <Section title="คัดกรอง" icon={ListChecks} empty="ยังไม่มีการคัดกรอง"
        list={screenings.map((s) => <ScreeningRow key={s.screening_id} s={s} {...p} />)} form={<AddScreening appId={appId} {...p} />} />
      <Section title="สัมภาษณ์" icon={Users} empty="ยังไม่มีการนัดสัมภาษณ์"
        list={interviews.map((i) => <InterviewRow key={i.interview_id} i={i} {...p} />)} form={<AddInterview appId={appId} {...p} />} />
      <Section title="แบบทดสอบงาน" icon={ClipboardCheck} empty="ยังไม่มีแบบทดสอบ"
        list={workTests.map((w) => <WorkTestRow key={w.test_id} w={w} {...p} />)} form={<AddWorkTest appId={appId} {...p} />} />
    </div>
  )
}
