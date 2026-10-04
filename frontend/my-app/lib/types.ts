export type Role = "applicant" | "recruitment"
export type AppStatus = "pending" | "screening" | "interview" | "passed" | "rejected"
export type Result = "pending" | "pass" | "fail"
export type InterviewStatus = "scheduled" | "completed" | "cancelled"

export type User = { user_id: number; full_name: string; email: string; phone: string; role: Role }
export type Job = {
  job_id: number; title: string; description: string; requirement: string
  location: string; status: "open" | "closed"; created_by: number
}
export type Application = {
  application_id: number; user_id: number; job_id: number
  apply_date: string; status: AppStatus; note: string
  applicant_name?: string; applicant_email?: string; applicant_phone?: string; job_title?: string
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

export const APP_STATUSES: AppStatus[] = ["pending", "screening", "interview", "passed", "rejected"]

export const APP_STATUS_LABEL: Record<AppStatus, string> = {
  pending: "รอพิจารณา",
  screening: "คัดกรอง",
  interview: "สัมภาษณ์",
  passed: "ผ่าน",
  rejected: "ไม่ผ่าน",
}

// full class strings so Tailwind can see them
export const APP_STATUS_COLOR: Record<AppStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  screening: "bg-sky-100 text-sky-700",
  interview: "bg-amber-100 text-amber-700",
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
