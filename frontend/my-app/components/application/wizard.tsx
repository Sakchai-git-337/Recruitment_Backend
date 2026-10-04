"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, Briefcase, Check, CheckCircle2, Loader2, MapPin, Send } from "lucide-react"
import { PublicShell } from "@/components/app/public-shell"
import { EmptyState } from "@/components/app/empty-state"
import { ErrorState, LoadingState } from "@/components/app/states"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ApiError, api, apiUpload } from "@/lib/api"
import {
  SECTIONS, STEP_COUNT, emptyForm, validateStep,
  type ApplicationForm, type Errors,
} from "@/lib/application-form"
import { DOC_TYPES, type Application, type Job } from "@/lib/types"
import { cn } from "@/lib/utils"
import { stepForError } from "@/lib/application-errors"
import { FieldGrid } from "./step-fields"
import { Review, StepConsent, StepDocuments, type Files } from "./step-documents"

const TITLES = SECTIONS.map((s, i) => (i === STEP_COUNT - 1 ? "เอกสารและยืนยัน" : s.title))
const JOB_ONLY = ["expected_salary", "available_start_date"] // never prefilled
const CONSENT_KEYS = ["pdpa_consent", "signature_name"]
const NO_DRAFT = ["national_id", ...CONSENT_KEYS]
const draftKey = (id: string) => `apply-draft-${id}`

type Phase = "loading" | "error" | "ready" | "applied" | "closed" | "done"

function isClosed(j: Job) {
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
  return j.status !== "open" || (!!j.closing_date && j.closing_date < today)
}

function readDraft(id: string): ApplicationForm | null {
  try {
    const raw = localStorage.getItem(draftKey(id))
    const v = raw ? JSON.parse(raw) : null
    return v && typeof v === "object" ? v : null
  } catch {
    return null
  }
}

/** known keys only; empty values never overwrite */
function merge(base: ApplicationForm, src: ApplicationForm | null, skip: string[] = []): ApplicationForm {
  const out = { ...base }
  for (const [k, v] of Object.entries(src ?? {})) {
    if (!(k in base) || skip.includes(k) || v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue
    out[k] = v
  }
  return out
}

function scrollToError(errs: Errors) {
  const first = Object.keys(errs)[0]
  if (!first) return
  requestAnimationFrame(() => {
    const el = document.getElementById("f-" + first.replace(/\./g, "-"))
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
    el?.focus?.({ preventScroll: true })
  })
}

export function ApplicationWizard({ jobId }: { jobId: string }) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [attempt, setAttempt] = useState(0)
  const [job, setJob] = useState<Job | null>(null)
  const [form, setForm] = useState<ApplicationForm>(emptyForm)
  const [files, setFiles] = useState<Files>({})
  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let live = true
    Promise.all([
      api<Job>(`/jobs/${jobId}`),
      api<Application[]>("/applications"),
      api<{ data: ApplicationForm }>("/me/application-form").catch(() => null),
    ])
      .then(([j, apps, prefill]) => {
        if (!live) return
        setJob(j)
        if (apps.some((a) => a.job_id === j.job_id)) return setPhase("applied")
        if (isClosed(j)) return setPhase("closed")
        // prefill first, then the draft on top, so typed values always win
        const draft = readDraft(jobId)
        setForm(merge(merge(emptyForm(), prefill?.data ?? null, [...JOB_ONLY, ...CONSENT_KEYS, ...Object.keys(draft ?? {})]), draft))
        setPhase("ready")
      })
      .catch(() => live && setPhase("error"))
    return () => { live = false }
  }, [jobId, attempt])

  // autosave draft (not the national ID, not files)
  useEffect(() => {
    if (phase !== "ready") return
    try {
      const rest = Object.fromEntries(Object.entries(form).filter(([k]) => !NO_DRAFT.includes(k)))
      localStorage.setItem(draftKey(jobId), JSON.stringify(rest))
    } catch {
      // storage blocked: no draft
    }
  }, [form, phase, jobId])

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  function docErrors(): Errors {
    const e: Errors = {}
    for (const d of DOC_TYPES) if (d.required && !(files[d.type]?.length)) e["doc_" + d.type] = `กรุณาแนบ${d.label}`
    return e
  }

  function goto(n: number) {
    setStep(n)
    setErrors({})
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function next() {
    const errs = validateStep(step, form)
    if (Object.keys(errs).length) {
      setErrors(errs)
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง")
      return scrollToError(errs)
    }
    setMaxStep((m) => Math.max(m, step + 1))
    goto(step + 1)
  }

  async function submit() {
    const docs = docErrors()
    let target = 0
    for (let i = 1; i <= STEP_COUNT && !target; i++) if (Object.keys(validateStep(i, form)).length) target = i
    if (!target && Object.keys(docs).length) target = STEP_COUNT
    if (target) {
      const here = { ...validateStep(target, form), ...(target === STEP_COUNT ? docs : {}) }
      setStep(target)
      setErrors(here)
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง")
      return scrollToError(here)
    }
    const fd = new FormData()
    fd.append("job_id", jobId)
    fd.append("form", JSON.stringify(form))
    for (const [type, list] of Object.entries(files)) for (const f of list) fd.append("doc_" + type, f)
    setSubmitting(true)
    try {
      await apiUpload("/applications", fd)
      try { localStorage.removeItem(draftKey(jobId)) } catch { /* nothing stored */ }
      setPhase("done")
      window.scrollTo({ top: 0 })
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setPhase("applied")
      else {
        const msg = e instanceof Error ? e.message : "ส่งใบสมัครไม่สำเร็จ"
        toast.error(msg)
        const t = e instanceof ApiError && e.status === 400 ? stepForError(msg) : null
        if (t) {
          const errs: Errors = t.field ? { [t.field]: msg } : {}
          setStep(t.step)
          setErrors(errs)
          if (t.field) scrollToError(errs)
          else requestAnimationFrame(() => document.getElementById("f-docs")?.scrollIntoView({ behavior: "smooth" }))
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (phase !== "ready") return <PublicShell><Shell>{phaseView(phase, job, () => { setPhase("loading"); setAttempt((a) => a + 1) })}</Shell></PublicShell>

  const section = SECTIONS[step - 1]
  const last = step === STEP_COUNT
  const stepDone = (n: number) => n < maxStep && Object.keys(validateStep(n, form)).length === 0

  return (
    <PublicShell>
      <Shell>
        <div className="mb-6">
          <Link href={`/jobs/${jobId}`} className="text-sm text-slate-500 hover:text-indigo-600">← กลับไปที่รายละเอียดตำแหน่ง</Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">สมัครงานออนไลน์</h1>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4 lg:sticky lg:top-20">
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <p className="text-xs font-medium text-slate-500">ตำแหน่งที่สมัคร</p>
              <p className="mt-1 font-semibold text-slate-900">{job?.title}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                {job?.department && <span className="inline-flex items-center gap-1"><Briefcase className="size-3.5" />{job.department}</span>}
                {job?.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{job.location}</span>}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-xs lg:hidden">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-900">{TITLES[step - 1]}</span>
                <span className="text-slate-500">ขั้นที่ {step}/{STEP_COUNT}</span>
              </div>
              <Progress value={(step / STEP_COUNT) * 100} />
            </div>
            <ol className="hidden rounded-xl border bg-card p-2 shadow-xs lg:block">
              {TITLES.map((t, i) => {
                const n = i + 1
                const done = stepDone(n)
                const active = n === step
                return (
                  <li key={t}>
                    <button
                      type="button" disabled={n > maxStep} onClick={() => goto(n)} aria-current={active ? "step" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed",
                        active ? "bg-indigo-50 font-medium text-indigo-700" : n <= maxStep ? "text-slate-700 hover:bg-slate-50" : "text-slate-400",
                      )}
                    >
                      <span className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        done ? "bg-emerald-500 text-white" : active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500",
                      )}>
                        {done ? <Check className="size-3.5" /> : n}
                      </span>
                      {t}
                    </button>
                  </li>
                )
              })}
            </ol>
          </aside>

          <section className="rounded-xl border bg-card shadow-xs">
            <header className="border-b px-5 py-4 sm:px-6">
              <p className="text-xs font-medium text-indigo-600">ขั้นที่ {step} จาก {STEP_COUNT}</p>
              <h2 className="text-lg font-semibold text-slate-900">{TITLES[step - 1]}</h2>
            </header>
            <div className="space-y-6 px-5 py-6 sm:px-6">
              {step === 1 && (
                <div className="flex items-center gap-3 rounded-lg bg-indigo-50/60 px-4 py-3 text-sm text-slate-700">
                  <Briefcase className="size-5 shrink-0 text-indigo-600" />
                  <span>คุณกำลังสมัครตำแหน่ง <b className="text-slate-900">{job?.title}</b></span>
                </div>
              )}
              {last && <h3 className="text-base font-semibold text-slate-900">คำถามเพิ่มเติม</h3>}
              <FieldGrid
                fields={last ? section.fields.filter((f) => !CONSENT_KEYS.includes(f.key)) : section.fields}
                data={form} form={form} errors={errors} onChange={set}
              />
              {last && (
                <>
                  <StepDocuments files={files} setFiles={setFiles} errors={errors} onReject={(m) => toast.error(m)} />
                  <StepConsent form={form} set={set} errors={errors} />
                  <Review form={form} files={files} jobTitle={job?.title ?? ""} />
                </>
              )}
            </div>
            <footer className="flex items-center justify-between gap-3 border-t bg-slate-50/60 px-5 py-4 sm:px-6">
              <Button type="button" variant="outline" disabled={step === 1 || submitting} onClick={() => goto(step - 1)}>
                <ArrowLeft className="size-4" /> ย้อนกลับ
              </Button>
              {last ? (
                <Button type="button" size="lg" disabled={submitting} onClick={submit}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} ส่งใบสมัคร
                </Button>
              ) : (
                <Button type="button" onClick={next}>ถัดไป <ArrowRight className="size-4" /></Button>
              )}
            </footer>
          </section>
        </div>
      </Shell>
    </PublicShell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
}

function phaseView(phase: Phase, job: Job | null, retry: () => void) {
  switch (phase) {
    case "loading": return <LoadingState rows={6} />
    case "error": return <ErrorState onRetry={retry} />
    case "applied":
      return (
        <EmptyState icon={CheckCircle2} title="คุณสมัครตำแหน่งนี้แล้ว" text="ติดตามสถานะใบสมัครของคุณได้ที่หน้าใบสมัครของฉัน"
          action={<Button asChild><Link href="/me/applications">ไปที่ใบสมัครของฉัน</Link></Button>} />
      )
    case "closed":
      return (
        <EmptyState icon={Briefcase} title="ตำแหน่งนี้ปิดรับสมัครแล้ว" text={job?.title}
          action={<Button asChild variant="outline"><Link href="/">ดูตำแหน่งงานอื่น</Link></Button>} />
      )
    default:
      return (
        <div className="mx-auto max-w-lg rounded-xl border bg-card px-6 py-14 text-center shadow-xs">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="size-9" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">ส่งใบสมัครเรียบร้อยแล้ว</h1>
          <p className="mt-2 text-sm text-slate-500">ขอบคุณที่สนใจตำแหน่ง {job?.title} ทีมงานจะติดต่อกลับหลังพิจารณาใบสมัคร</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button asChild><Link href="/me/applications">ดูใบสมัครของฉัน</Link></Button>
            <Button asChild variant="outline"><Link href="/">กลับหน้าแรก</Link></Button>
          </div>
        </div>
      )
  }
}
