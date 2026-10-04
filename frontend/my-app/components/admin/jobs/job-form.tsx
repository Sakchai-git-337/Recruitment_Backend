"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABEL, type EmploymentType, type Job } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/app/form-field"

type Values = {
  title: string; department: string; employment_type: EmploymentType; location: string; headcount: string
  salary_min: string; salary_max: string; description: string; requirement: string
  status: Job["status"]; closing_date: string
}

const toValues = (j?: Job): Values => ({
  title: j?.title ?? "", department: j?.department ?? "", employment_type: j?.employment_type ?? "full_time",
  location: j?.location ?? "", headcount: String(j?.headcount ?? 1),
  salary_min: j?.salary_min != null ? String(j.salary_min) : "", salary_max: j?.salary_max != null ? String(j.salary_max) : "",
  description: j?.description ?? "", requirement: j?.requirement ?? "",
  status: j?.status ?? "open", closing_date: j?.closing_date ?? "",
})

const num = (s: string) => (s.trim() === "" ? null : Number(s))

function validate(v: Values): Record<string, string> {
  const e: Record<string, string> = {}
  if (!v.title.trim()) e.title = "กรุณากรอกชื่อตำแหน่ง"
  if (!v.location.trim()) e.location = "กรุณากรอกสถานที่ทำงาน"
  if (!v.description.trim()) e.description = "กรุณากรอกรายละเอียดงาน"
  if (!v.requirement.trim()) e.requirement = "กรุณากรอกคุณสมบัติ"
  const h = Number(v.headcount)
  if (!Number.isInteger(h) || h < 1) e.headcount = "ต้องเป็นจำนวนเต็มตั้งแต่ 1"
  for (const k of ["salary_min", "salary_max"] as const) {
    const n = num(v[k])
    if (n !== null && (!Number.isInteger(n) || n < 0)) e[k] = "ต้องเป็นจำนวนเต็มไม่ติดลบ"
  }
  const [a, b] = [num(v.salary_min), num(v.salary_max)]
  if (!e.salary_min && !e.salary_max && a !== null && b !== null && a > b) e.salary_max = "เงินเดือนสูงสุดต้องไม่น้อยกว่าขั้นต่ำ"
  return e
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs sm:p-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function JobForm({ job }: { job?: Job }) {
  const router = useRouter()
  const [v, setV] = useState<Values>(() => toValues(job))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((p) => ({ ...p, [k]: val }))
    setErrors((p) => ({ ...p, [k]: "" }))
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate(v)
    setErrors(e)
    if (Object.values(e).some(Boolean)) {
      toast.error("กรุณาตรวจสอบข้อมูลที่กรอก")
      return
    }
    const body = {
      title: v.title.trim(), department: v.department.trim(), employment_type: v.employment_type,
      location: v.location.trim(), headcount: Number(v.headcount),
      salary_min: num(v.salary_min), salary_max: num(v.salary_max),
      description: v.description.trim(), requirement: v.requirement.trim(),
      status: v.status, closing_date: v.closing_date || null,
    }
    setSaving(true)
    try {
      if (job) await api(`/jobs/${job.job_id}`, { method: "PATCH", body })
      else await api("/jobs", { method: "POST", body })
      toast.success(job ? "บันทึกการแก้ไขแล้ว" : "สร้างตำแหน่งงานแล้ว")
      router.push("/admin/jobs")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-6">
      <Section title="ข้อมูลตำแหน่ง" description="ข้อมูลหลักที่ผู้สมัครจะเห็น">
        <FormField label="ชื่อตำแหน่ง" id="title" required error={errors.title} className="sm:col-span-2">
          <Input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="เช่น Frontend Developer" aria-invalid={!!errors.title} />
        </FormField>
        <FormField label="แผนก" id="department">
          <Input id="department" value={v.department} onChange={(e) => set("department", e.target.value)} placeholder="เช่น วิศวกรรม" />
        </FormField>
        <FormField label="ประเภทการจ้างงาน" id="employment_type">
          <Select value={v.employment_type} onValueChange={(x) => set("employment_type", x as EmploymentType)}>
            <SelectTrigger id="employment_type" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{EMPLOYMENT_TYPE_LABEL[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="สถานที่ทำงาน" id="location" required error={errors.location}>
          <Input id="location" value={v.location} onChange={(e) => set("location", e.target.value)} placeholder="เช่น กรุงเทพฯ" aria-invalid={!!errors.location} />
        </FormField>
        <FormField label="จำนวนที่รับ (คน)" id="headcount" required error={errors.headcount}>
          <Input id="headcount" type="number" min={1} value={v.headcount} onChange={(e) => set("headcount", e.target.value)} aria-invalid={!!errors.headcount} />
        </FormField>
      </Section>

      <Section title="ค่าตอบแทน" description="เว้นว่างไว้หากไม่ต้องการระบุ (บาทต่อเดือน)">
        <FormField label="เงินเดือนขั้นต่ำ" id="salary_min" error={errors.salary_min}>
          <Input id="salary_min" type="number" min={0} value={v.salary_min} onChange={(e) => set("salary_min", e.target.value)} placeholder="30000" aria-invalid={!!errors.salary_min} />
        </FormField>
        <FormField label="เงินเดือนสูงสุด" id="salary_max" error={errors.salary_max}>
          <Input id="salary_max" type="number" min={0} value={v.salary_max} onChange={(e) => set("salary_max", e.target.value)} placeholder="45000" aria-invalid={!!errors.salary_max} />
        </FormField>
      </Section>

      <Section title="รายละเอียด">
        <FormField label="รายละเอียดงาน" id="description" required error={errors.description} className="sm:col-span-2">
          <Textarea id="description" rows={6} value={v.description} onChange={(e) => set("description", e.target.value)} aria-invalid={!!errors.description} />
        </FormField>
        <FormField label="คุณสมบัติผู้สมัคร" id="requirement" required error={errors.requirement} className="sm:col-span-2">
          <Textarea id="requirement" rows={6} value={v.requirement} onChange={(e) => set("requirement", e.target.value)} aria-invalid={!!errors.requirement} />
        </FormField>
      </Section>

      <Section title="การรับสมัคร">
        <FormField label="สถานะ" id="status">
          <Select value={v.status} onValueChange={(x) => set("status", x as Job["status"])}>
            <SelectTrigger id="status" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">เปิดรับสมัคร</SelectItem>
              <SelectItem value="closed">ปิดรับสมัคร</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="วันปิดรับสมัคร" id="closing_date" hint="เว้นว่าง = ไม่กำหนด">
          <Input id="closing_date" type="date" value={v.closing_date} onChange={(e) => set("closing_date", e.target.value)} />
        </FormField>
      </Section>

      <div className="flex justify-end gap-2 pb-4">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/jobs")} disabled={saving}>ยกเลิก</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {job ? "บันทึกการแก้ไข" : "สร้างตำแหน่งงาน"}
        </Button>
      </div>
    </form>
  )
}
