"use client"

import { ShieldCheck } from "lucide-react"
import { FormField } from "@/components/app/form-field"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { DOC_TYPES } from "@/lib/types"
import { formatMoney } from "@/lib/format"
import { OPTION_LABELS, type ApplicationForm, type Errors, type Row } from "@/lib/application-form"
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
  return (
    <div id="f-docs" className="scroll-mt-24 space-y-3">
      <div>
        <h3 className="text-base font-semibold text-slate-900">เอกสารประกอบการสมัคร</h3>
        <p className="mt-0.5 text-sm text-slate-500">ต้องแนบ Resume และเอกสารวุฒิการศึกษา ส่วนเอกสารอื่นแนบเพิ่มได้ตามต้องการ</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {DOC_TYPES.map((d) => (
          <FileDrop
            key={d.type} id={`f-doc_${d.type}`} label={d.label} required={d.required} multiple={d.repeatable}
            files={files[d.type] ?? []} error={errors["doc_" + d.type]} onReject={onReject}
            canAdd={canAddFile(files, d.type)}
            onChange={(next) => setFiles({ ...files, [d.type]: next })}
          />
        ))}
      </div>
    </div>
  )
}

export function StepConsent({ form, set, errors }: {
  form: ApplicationForm; set: (k: string, v: unknown) => void; errors: Errors
}) {
  const name = `${form.first_name_th ?? ""} ${form.last_name_th ?? ""}`.trim()
  return (
    <div className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-5">
      <div className="flex items-center gap-2 text-slate-900">
        <ShieldCheck className="size-5 text-indigo-600" />
        <h3 className="text-base font-semibold">ความยินยอมและการลงนาม</h3>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">
        ข้าพเจ้ารับรองว่าข้อมูลที่กรอกในใบสมัครนี้เป็นความจริงทุกประการ และยินยอมให้บริษัทเก็บรวบรวม ใช้
        และเปิดเผยข้อมูลส่วนบุคคลและเอกสารที่แนบ เพื่อวัตถุประสงค์ในการพิจารณาคัดเลือกและติดต่อกลับเกี่ยวกับการสมัครงาน
        ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 หากตรวจพบว่าข้อมูลเป็นเท็จ
        บริษัทมีสิทธิ์ปฏิเสธการรับเข้าทำงานหรือเลิกจ้างได้ทันที
      </p>
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox
          id="f-pdpa_consent" className="mt-0.5" checked={form.pdpa_consent === true}
          aria-invalid={!!errors.pdpa_consent || undefined}
          onCheckedChange={(c) => set("pdpa_consent", c === true)}
        />
        <span className="text-sm text-slate-800">ข้าพเจ้ายอมรับและยินยอมตามข้อความข้างต้น <span className="text-red-500">*</span></span>
      </label>
      {errors.pdpa_consent && <p role="alert" className="text-xs text-red-600">{errors.pdpa_consent}</p>}
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
  const last = edu[edu.length - 1]
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
    <div className="rounded-xl border bg-white p-5">
      <h3 className="mb-3 text-base font-semibold text-slate-900">ตรวจสอบก่อนส่ง</h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs font-medium text-slate-500">{k}</dt>
            <dd className="mt-0.5 truncate text-sm text-slate-900">{v || "-"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 border-t pt-3">
        <p className="text-xs font-medium text-slate-500">เอกสารที่แนบ ({fileCount} ไฟล์)</p>
        {attached.length === 0 ? <p className="mt-0.5 text-sm text-slate-900">-</p> : (
          <ul className="mt-1 space-y-1 text-sm">
            {attached.map((d) => (
              <li key={d.type} className="min-w-0">
                <span className="text-slate-500">{d.label}: </span>
                <span className="break-words text-slate-900">{files[d.type].map((f) => f.name).join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
