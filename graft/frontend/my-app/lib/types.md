# frontend/my-app/lib/types.ts

- Role · type · L1-L1 — type Role = "applicant" | "recruitment"
- AppStatus · type · L2-L2 — type AppStatus = "pending" | "screening" | "interview" | "passed" | "rejected"
- Result · type · L3-L3 — type Result = "pending" | "pass" | "fail"
- InterviewStatus · type · L4-L4 — type InterviewStatus = "scheduled" | "completed" | "cancelled"
- User · type · L6-L6 — type User = { user_id: number; full_name: string; email: string; phone: string; role: Role }
- Job · type · L7-L10 — type Job = { job_id: number; title: string; description: string; requirement: string location: string; status: "open" | "closed"; created_by: number }
- Application · type · L11-L14 — type Application = { application_id: number; user_id: number; job_id: number apply_date: string; status: AppStatus; note: string }
- Screening · type · L15-L18 — type Screening = { screening_id: number; application_id: number; screened_by: number result: Result; note: string; screening_date: string }
- Interview · type · L19-L22 — type Interview = { interview_id: number; application_id: number; interviewer_id: number interview_date: string; interview_time: string; status: InterviewStatus; result: string; note: string }
- WorkTest · type · L23-L26 — type WorkTest = { test_id: number; application_id: number; assigned_by: number test_date: string; test_result: string; test_note: string }
- groupByStatus · function · L55-L59 — function groupByStatus(apps: Application[]): Record<AppStatus, Application[]>
- countByStatus · function · L61-L64 — function countByStatus(apps: Application[]): Record<AppStatus, number>
