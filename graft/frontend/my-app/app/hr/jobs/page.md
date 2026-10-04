# frontend/my-app/app/hr/jobs/page.tsx

- Form · type · L18-L18 — type Form = Omit<Job, "job_id" | "created_by">
- HrJobsPage · function · L21-L186 — function HrJobsPage()
- reload · function · L31-L31 — reload = ()
- openForm · function · L45-L49 — function openForm(job?: Job)
- mutate · function · L51-L63 — async function mutate(fn: () => Promise<unknown>, after?: () => void)
- save · function · L65-L77 — function save(e: React.FormEvent)
- toggle · function · L79-L84 — function toggle(job: Job)
- set · function · L86-L87 — set = (k: keyof Form)
