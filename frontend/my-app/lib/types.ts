export type Role = "applicant" | "recruitment"
export type AppStatus = "pending" | "screening" | "probation" | "interview" | "passed" | "rejected"
export type Result = "pending" | "pass" | "fail"
export type InterviewStatus = "scheduled" | "completed" | "cancelled"

export type User = { user_id: number; full_name: string; email: string; phone: string; role: Role }
export type EmploymentType = "full_time" | "part_time" | "contract" | "internship"
export type Job = {
  job_id: number; title: string; description: string; requirement: string
  location: string; status: "open" | "closed"; created_by: number
  department: string; employment_type: EmploymentType
  salary_min: number | null; salary_max: number | null
  headcount: number; closing_date: string | null // YYYY-MM-DD
  has_probation: boolean
  /** applicant requirements (null / "" = none); min_education is an education level key */
  min_age: number | null; min_experience_years: number | null; min_education: string
  created_at: string // when the job was posted (ISO)
}
export type ApplicationDocument = {
  document_id: number; doc_type: string; filename: string
  content_type: string; size_bytes: number; uploaded_at: string
}
export type Application = {
  application_id: number; user_id: number; job_id: number
  apply_date: string; status: AppStatus; note: string; rejected_from?: AppStatus | ""
  applicant_name?: string; applicant_email?: string; applicant_phone?: string; job_title?: string
  job_status?: "open" | "closed"; job_closing_date?: string | null; job_has_probation?: boolean
}
export type Screening = {
  screening_id: number; application_id: number; screened_by: number
  result: Result; note: string; screening_date: string
}
export type Interview = {
  interview_id: number; application_id: number; interviewer_id: number
  interview_date: string; interview_time: string; status: InterviewStatus; result: string; note: string
}
export type WorkTest = {
  test_id: number; application_id: number; assigned_by: number
  test_date: string; test_result: string; test_note: string
}

export const APP_STATUSES: AppStatus[] = ["pending", "screening", "probation", "interview", "passed", "rejected"]

export const APP_STATUS_LABEL: Record<AppStatus, string> = {
  pending: "รอพิจารณา",
  screening: "คัดกรอง",
  probation: "ทดลองงาน",
  interview: "สัมภาษณ์",
  passed: "ผ่าน",
  rejected: "ไม่ผ่าน",
}

// full class strings so Tailwind can see them
export const APP_STATUS_COLOR: Record<AppStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  screening: "bg-sky-100 text-sky-700",
  interview: "bg-amber-100 text-amber-700",
  probation: "bg-teal-100 text-teal-700",
  passed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
}

export const JOB_STATUS_LABEL: Record<Job["status"], string> = { open: "เปิดรับ", closed: "ปิดรับ" }
export const RESULT_LABEL: Record<Result, string> = { pending: "รอผล", pass: "ผ่าน", fail: "ไม่ผ่าน" }
export const INTERVIEW_STATUS_LABEL: Record<InterviewStatus, string> = {
  scheduled: "นัดแล้ว",
  completed: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
}

export function groupByStatus(apps: Application[]): Record<AppStatus, Application[]> {
  const groups = Object.fromEntries(APP_STATUSES.map((s) => [s, [] as Application[]])) as Record<AppStatus, Application[]>
  for (const a of apps) groups[a.status]?.push(a)
  return groups
}

export function countByStatus(apps: Application[]): Record<AppStatus, number> {
  const groups = groupByStatus(apps)
  return Object.fromEntries(APP_STATUSES.map((s) => [s, groups[s].length])) as Record<AppStatus, number>
}

export const EMPLOYMENT_TYPES: EmploymentType[] = ["full_time", "part_time", "contract", "internship"]
export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: "เต็มเวลา",
  part_time: "พาร์ทไทม์",
  contract: "สัญญาจ้าง",
  internship: "ฝึกงาน",
}

/** Upload slots of the application form (spec 6.9). `repeatable` = several files allowed. */
export const DOC_TYPES: { type: string; label: string; required: boolean; repeatable?: boolean }[] = [
  { type: "resume", label: "Resume / CV", required: true },
  { type: "id_card", label: "สำเนาบัตรประชาชน", required: true },
  { type: "house_registration", label: "สำเนาทะเบียนบ้าน", required: true },
  { type: "education", label: "สำเนาวุฒิการศึกษา / Transcript", required: true },
  { type: "work_certificate", label: "หนังสือรับรองการทำงาน (ถ้ามี)", required: false },
  { type: "payslip", label: "สลิปเงินเดือนล่าสุด (ถ้ามี)", required: false },
  { type: "certificate", label: "ใบรับรองต่างๆ ที่เป็นประโยชน์ต่อการพิจารณา", required: false, repeatable: true },
  { type: "marriage_certificate", label: "ทะเบียนสมรส", required: false },
  { type: "name_change", label: "หลักฐานการเปลี่ยนชื่อ-สกุล", required: false },
  { type: "military", label: "สด.9 / สด.43", required: false },
  { type: "driving_license", label: "ใบขับขี่", required: false },
  { type: "other", label: "อื่นๆ", required: false, repeatable: true },
]
export const DOC_TYPE_LABEL: Record<string, string> = Object.fromEntries(DOC_TYPES.map((d) => [d.type, d.label]))
