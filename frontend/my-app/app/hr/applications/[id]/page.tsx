"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { api, useUser } from "@/lib/api"
import {
  INTERVIEW_STATUS_LABEL,
  RESULT_LABEL,
  type AppStatus,
  type Application,
  type Interview,
  type InterviewStatus,
  type Job,
  type Result,
  type Screening,
  type User,
  type WorkTest,
} from "@/lib/types"
import { ErrorText, Loading, StatusBar, inputClass } from "@/components/app-ui"
import { Button } from "@/components/ui/button"

type Data = {
  app: Application
  user: User
  job: Job
  screenings: Screening[]
  interviews: Interview[]
  workTests: WorkTest[]
}
type Run = (fn: () => Promise<unknown>) => Promise<boolean>

const day = (s: string) => s.slice(0, 10)
const thDate = (s: string) => new Date(s).toLocaleDateString("th-TH")
const time = (s: string) => s.slice(0, 5)

function Select<T extends string>({ value, onChange, labels }: { value: T; onChange: (v: T) => void; labels: Record<T, string> }) {
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {(Object.keys(labels) as T[]).map((k) => (
        <option key={k} value={k}>
          {labels[k]}
        </option>
      ))}
    </select>
  )
}

function Section({ title, empty, children, form }: { title: string; empty: boolean; children: ReactNode; form: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {empty ? <p className="text-sm text-gray-500">ยังไม่มีข้อมูล</p> : <div className="space-y-2">{children}</div>}
      <div className="border-t border-gray-100 pt-3">{form}</div>
    </section>
  )
}

const rowClass = "grid gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-2 lg:grid-cols-6"
const formClass = "grid gap-2 sm:grid-cols-2 lg:grid-cols-4"

function ScreeningRow({ s, run, busy }: { s: Screening; run: Run; busy: boolean }) {
  const [result, setResult] = useState<Result>(s.result)
  const [note, setNote] = useState(s.note)
  return (
    <div className={rowClass}>
      <Select value={result} onChange={setResult} labels={RESULT_LABEL} />
      <input className={`${inputClass} lg:col-span-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ" />
      <span className="self-center text-sm text-gray-500">{thDate(s.screening_date)}</span>
      <Button type="button" disabled={busy} onClick={() => run(() => api(`/screenings/${s.screening_id}`, { method: "PATCH", body: { result, note } }))}>
        บันทึก
      </Button>
    </div>
  )
}

function InterviewRow({ i, run, busy }: { i: Interview; run: Run; busy: boolean }) {
  const [date, setDate] = useState(day(i.interview_date))
  const [t, setT] = useState(time(i.interview_time))
  const [status, setStatus] = useState<InterviewStatus>(i.status)
  const [result, setResult] = useState(i.result)
  const [note, setNote] = useState(i.note)
  return (
    <div className={rowClass}>
      <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      <input type="time" className={inputClass} value={t} onChange={(e) => setT(e.target.value)} />
      <Select value={status} onChange={setStatus} labels={INTERVIEW_STATUS_LABEL} />
      <input className={inputClass} value={result} onChange={(e) => setResult(e.target.value)} placeholder="ผลสัมภาษณ์" />
      <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ" />
      <Button
        type="button"
        disabled={busy || !date || !t}
        onClick={() =>
          run(() => api(`/interviews/${i.interview_id}`, { method: "PATCH", body: { interview_date: date, interview_time: t, status, result, note } }))
        }
      >
        บันทึก
      </Button>
    </div>
  )
}

function WorkTestRow({ w, run, busy }: { w: WorkTest; run: Run; busy: boolean }) {
  const [result, setResult] = useState((w.test_result || "pending") as Result)
  const [note, setNote] = useState(w.test_note)
  return (
    <div className={rowClass}>
      <span className="self-center text-sm text-gray-500">{thDate(w.test_date)}</span>
      <Select value={result} onChange={setResult} labels={RESULT_LABEL} />
      <input className={`${inputClass} lg:col-span-3`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ" />
      <Button type="button" disabled={busy} onClick={() => run(() => api(`/work-tests/${w.test_id}`, { method: "PATCH", body: { test_result: result, test_note: note } }))}>
        บันทึก
      </Button>
    </div>
  )
}

function AddScreening({ appId, uid, run, busy }: { appId: number; uid: number; run: Run; busy: boolean }) {
  const [result, setResult] = useState<Result>("pending")
  const [note, setNote] = useState("")
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(() => api("/screenings", { method: "POST", body: { application_id: appId, screened_by: uid, result, note } })).then((ok) => ok && setNote(""))
  }
  return (
    <form onSubmit={submit} className={formClass}>
      <Select value={result} onChange={setResult} labels={RESULT_LABEL} />
      <input className={`${inputClass} lg:col-span-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ" />
      <Button type="submit" disabled={busy}>เพิ่มการคัดกรอง</Button>
    </form>
  )
}

function AddInterview({ appId, uid, run, busy }: { appId: number; uid: number; run: Run; busy: boolean }) {
  const [date, setDate] = useState("")
  const [t, setT] = useState("")
  const [note, setNote] = useState("")
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(() =>
      api("/interviews", {
        method: "POST",
        body: { application_id: appId, interviewer_id: uid, interview_date: date, interview_time: t, status: "scheduled", result: "", note },
      }),
    ).then((ok) => {
      if (!ok) return
      setDate("")
      setT("")
      setNote("")
    })
  }
  return (
    <form onSubmit={submit} className={formClass}>
      <input type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      <input type="time" required className={inputClass} value={t} onChange={(e) => setT(e.target.value)} />
      <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ" />
      <Button type="submit" disabled={busy}>นัดสัมภาษณ์</Button>
    </form>
  )
}

function AddWorkTest({ appId, uid, run, busy }: { appId: number; uid: number; run: Run; busy: boolean }) {
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(() =>
      api("/work-tests", {
        method: "POST",
        body: { application_id: appId, assigned_by: uid, test_date: new Date(date).toISOString(), test_result: "pending", test_note: note },
      }),
    ).then((ok) => {
      if (!ok) return
      setDate("")
      setNote("")
    })
  }
  return (
    <form onSubmit={submit} className={formClass}>
      <input type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      <input className={`${inputClass} lg:col-span-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ" />
      <Button type="submit" disabled={busy}>มอบหมายแบบทดสอบ</Button>
    </form>
  )
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const me = useUser()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const reload = () => setTick((t) => t + 1)

  useEffect(() => {
    api<Application>(`/applications/${id}`)
      .then((app) =>
        Promise.all([
          app,
          api<User>(`/users/${app.user_id}`),
          api<Job>(`/jobs/${app.job_id}`),
          api<Screening[] | null>("/screenings"),
          api<Interview[] | null>("/interviews"),
          api<WorkTest[] | null>("/work-tests"),
        ]),
      )
      .then(([app, user, job, s, i, w]) => {
        setData({
          app,
          user,
          job,
          screenings: (s ?? []).filter((x) => x.application_id === app.application_id),
          interviews: (i ?? []).filter((x) => x.application_id === app.application_id),
          workTests: (w ?? []).filter((x) => x.application_id === app.application_id),
        })
        setNote(null)
      })
      .catch((e: Error) => setError(e.message))
  }, [id, tick])

  if (!me) return null
  if (!data) return error ? <ErrorText message={error} /> : <Loading />

  const { app, user, job } = data
  const run: Run = async (fn) => {
    let ok = false
    setError("")
    setBusy(true)
    try {
      await fn()
      ok = true
      reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
    return ok
  }
  const save = (body: { status: AppStatus; note: string }) => run(() => api(`/applications/${id}`, { method: "PATCH", body }))
  const noteValue = note ?? app.note

  return (
    <div className="space-y-4">
      <Link href={`/hr/jobs/${job.job_id}`} className="text-sm text-gray-600 hover:text-gray-900">
        ← {job.title}
      </Link>
      <h1 className="text-xl font-semibold">{user.full_name}</h1>
      <StatusBar value={app.status} onChange={busy ? undefined : (s) => save({ status: s, note: noteValue })} />
      <ErrorText message={error} />

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">อีเมล</dt><dd className="break-all">{user.email}</dd></div>
          <div><dt className="text-gray-500">เบอร์โทร</dt><dd>{user.phone}</dd></div>
          <div><dt className="text-gray-500">ตำแหน่ง</dt><dd>{job.title}</dd></div>
          <div><dt className="text-gray-500">วันที่สมัคร</dt><dd>{thDate(app.apply_date)}</dd></div>
        </dl>
        <label className="block text-sm text-gray-500">
          บันทึกภายใน
          <textarea className={`${inputClass} mt-1`} rows={3} value={noteValue} onChange={(e) => setNote(e.target.value)} />
        </label>
        <Button type="button" disabled={busy} onClick={() => save({ status: app.status, note: noteValue })}>
          บันทึก
        </Button>
      </section>

      <Section
        title="คัดกรอง"
        empty={!data.screenings.length}
        form={<AddScreening appId={app.application_id} uid={me.user_id} run={run} busy={busy} />}
      >
        {data.screenings.map((s) => <ScreeningRow key={s.screening_id} s={s} run={run} busy={busy} />)}
      </Section>

      <Section
        title="สัมภาษณ์"
        empty={!data.interviews.length}
        form={<AddInterview appId={app.application_id} uid={me.user_id} run={run} busy={busy} />}
      >
        {data.interviews.map((i) => <InterviewRow key={i.interview_id} i={i} run={run} busy={busy} />)}
      </Section>

      <Section
        title="แบบทดสอบงาน"
        empty={!data.workTests.length}
        form={<AddWorkTest appId={app.application_id} uid={me.user_id} run={run} busy={busy} />}
      >
        {data.workTests.map((w) => <WorkTestRow key={w.test_id} w={w} run={run} busy={busy} />)}
      </Section>
    </div>
  )
}
