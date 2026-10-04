"use client"

import { ChevronDown, ShieldCheck } from "lucide-react"
import { FormField } from "@/components/app/form-field"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { DOC_TYPES } from "@/lib/types"
import { formatMoney } from "@/lib/format"
import { EDUCATION_LEVELS, OPTION_LABELS, type ApplicationForm, type Errors, type Row } from "@/lib/application-form"
import { FileDrop } from "./file-drop"

export type Files = Record<string, File[]>

export const MAX_TOTAL = 30 * 1024 * 1024
export const MAX_FILES = 15

/** whole-submission limits mirrored from the server */
export function canAddFile(files: Files, type: string) {
  return (f: File, pending: File[]): string | null => {
    const others = Object.entries(files).filter(([t]) => t !== type).flatMap(([, v]) => v)
    const all = [...others, ...pending]
    if (all.length >= MAX_FILES) return `แนบไฟล์ได้ไม่เกิน ${MAX_FILES} ไฟล์`
    if (all.reduce((s, x) => s + x.size, 0) + f.size > MAX_TOTAL) return "ขนาดไฟล์รวมเกิน 30 MB"
    return null
  }
}

export function StepDocuments({ files, setFiles, errors, onReject }: {
  files: Files; setFiles: (f: Files) => void; errors: Errors; onReject: (m: string) => void
}) {
  const required = DOC_TYPES.filter((d) => d.required)
  const optional = DOC_TYPES.filter((d) => !d.required)
  const slot = (d: (typeof DOC_TYPES)[number]) => (
    <FileDrop
      key={d.type} id={`f-doc_${d.type}`} label={d.label} required={d.required} multiple={d.repeatable}
      files={files[d.type] ?? []} error={errors["doc_" + d.type]} onReject={onReject}
      canAdd={canAddFile(files, d.type)}
      onChange={(next) => setFiles({ ...files, [d.type]: next })}
    />
  )
  return (
    <div id="f-docs" className="scroll-mt-24 space-y-3">
      <div>
        <h3 className="text-base font-semibold text-foreground">เอกสารประกอบการสมัคร</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">ต้องแนบ Resume และเอกสารวุฒิการศึกษา ส่วนเอกสารอื่นแนบเพิ่มได้ตามต้องการ</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">{required.map(slot)}</div>
      <details className="group rounded-lg border bg-muted/60 open:bg-transparent" open={optional.some((d) => files[d.type]?.length) || undefined}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium text-foreground/80 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          เอกสารเพิ่มเติม (ไม่บังคับ)
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 px-4 pb-4 lg:grid-cols-2">{optional.map(slot)}</div>
      </details>
    </div>
  )
}

export function StepConsent({ form, set, errors }: {
  form: ApplicationForm; set: (k: string, v: unknown) => void; errors: Errors
}) {
  const name = `${form.first_name_th ?? ""} ${form.last_name_th ?? ""}`.trim()
  return (
    <div className="space-y-4 rounded-xl border border-indigo-100 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-500/10 p-5">
      <div className="flex items-center gap-2 text-foreground">
        <ShieldCheck className="size-5 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-base font-semibold">ความยินยอมและการลงนาม</h3>
      </div>
      <div tabIndex={0} aria-label="ข้อความยินยอมการเก็บและใช้ข้อมูลส่วนบุคคล"
        className="max-h-64 space-y-3 overflow-y-auto rounded-lg border bg-card p-4 text-sm leading-relaxed text-foreground/70 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <p>
          ข้าพเจ้ายินยอมให้บริษัทเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลและเอกสารที่แนบมากับใบสมัครนี้
          เพื่อวัตถุประสงค์ในการพิจารณาคัดเลือก ติดต่อกลับ และดำเนินการเกี่ยวกับการสมัครงาน
          ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            ข้าพเจ้ายินยอมโดยชัดแจ้งให้บริษัทเก็บรวบรวมและใช้ข้อมูลประวัติอาชญากรรมและข้อมูลสุขภาพของข้าพเจ้า
            เพื่อประกอบการตรวจสอบและคัดกรองผู้สมัคร
          </li>
          <li>
            ข้าพเจ้ายินยอมให้บริษัทใช้ข้อมูลเชื้อชาติและศาสนา เพื่อการยืนยันตัวตนและเพื่อการปฏิบัติต่อผู้สมัครอย่างเท่าเทียมกัน
          </li>
          <li>
            ข้าพเจ้ายินยอมให้บริษัทเปิดเผยข้อมูลของข้าพเจ้าแก่บริษัทในเครือและกลุ่มบริษัท เพื่อวัตถุประสงค์ในการสรรหาบุคลากร
          </li>
          <li>
            ข้าพเจ้ามีสิทธิ์ถอนความยินยอมได้ทุกเมื่อ ทั้งนี้ การถอนความยินยอมอาจมีผลต่อการพิจารณาใบสมัครของข้าพเจ้า
          </li>
          <li>
            ข้าพเจ้ารับรองว่าได้แจ้งให้บุคคลที่ข้าพเจ้าระบุข้อมูลไว้ในใบสมัคร (เช่น สมาชิกในครอบครัวและผู้ติดต่อฉุกเฉิน) ทราบแล้ว
            และได้รับความยินยอมจากบุคคลเหล่านั้นให้บริษัทเก็บรวบรวมและใช้ข้อมูลของเขาเพื่อวัตถุประสงค์ข้างต้น
          </li>
          <li>
            ข้าพเจ้ารับรองว่าข้อมูลที่กรอกในใบสมัครนี้เป็นความจริงทุกประการ
            หากตรวจพบว่าข้อมูลเป็นเท็จ บริษัทมีสิทธิ์ปฏิเสธการรับเข้าทำงานหรือเลิกจ้างได้โดยไม่ต้องจ่ายค่าชดเชยใดๆ
          </li>
        </ol>
      </div>
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox
          id="f-pdpa_consent" className="mt-0.5" checked={form.pdpa_consent === true}
          aria-invalid={!!errors.pdpa_consent || undefined}
          onCheckedChange={(c) => set("pdpa_consent", c === true)}
        />
        <span className="text-sm text-foreground">ข้าพเจ้ายอมรับและยินยอมตามข้อความข้างต้น <span className="text-red-500 dark:text-red-400">*</span></span>
      </label>
      {errors.pdpa_consent && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{errors.pdpa_consent}</p>}
      <FormField label="ลงชื่อ (พิมพ์ชื่อ-นามสกุลของท่าน)" id="f-signature_name" required error={errors.signature_name}
        hint={name ? `พิมพ์ให้ตรงกับ: ${name}` : "กรุณากรอกชื่อ-นามสกุลในขั้นตอนข้อมูลส่วนตัวก่อน"}>
        <Input id="f-signature_name" value={String(form.signature_name ?? "")} autoComplete="off"
          aria-invalid={!!errors.signature_name || undefined}
          onChange={(e) => set("signature_name", e.target.value)} />
      </FormField>
    </div>
  )
}

export function Review({ form, files, jobTitle }: { form: ApplicationForm; files: Files; jobTitle: string }) {
  const edu = (form.education as Row[]) ?? []
  const rank = (r: Row) => EDUCATION_LEVELS.indexOf(r.level as string)
  const last = edu.reduce<Row | undefined>((best, r) => (best === undefined || rank(r) > rank(best) ? r : best), undefined)
  const fileCount = Object.values(files).reduce((s, v) => s + v.length, 0)
  const rows: [string, string][] = [
    ["ตำแหน่ง", jobTitle],
    ["ชื่อ-นามสกุล", `${form.title_th ?? ""}${form.first_name_th ?? ""} ${form.last_name_th ?? ""}`.trim()],
    ["เบอร์โทรศัพท์", String(form.mobile_phone ?? "-")],
    ["อีเมล", String(form.email ?? "-")],
    ["เงินเดือนที่คาดหวัง", typeof form.expected_salary === "number" ? formatMoney(form.expected_salary) : "-"],
    ["การศึกษาสูงสุด", last ? `${OPTION_LABELS["education.level"]?.[String(last.level)] ?? ""} ${last.institute ?? ""}`.trim() || "-" : "-"],
  ]
  const attached = DOC_TYPES.filter((d) => files[d.type]?.length)
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-3 text-base font-semibold text-foreground">ตรวจสอบก่อนส่ง</h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 truncate text-sm text-foreground">{v || "-"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">เอกสารที่แนบ ({fileCount} ไฟล์)</p>
        {attached.length === 0 ? <p className="mt-0.5 text-sm text-foreground">-</p> : (
          <ul className="mt-1 space-y-1 text-sm">
            {attached.map((d) => (
              <li key={d.type} className="min-w-0">
                <span className="text-muted-foreground">{d.label}: </span>
                <span className="break-words text-foreground">{files[d.type].map((f) => f.name).join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
