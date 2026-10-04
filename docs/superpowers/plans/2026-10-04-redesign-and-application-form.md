# Redesign + Online Application Form — Spec & Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. Sections 1–7 are the binding **spec**; section 8 holds the tasks.

**Goal:** Rebuild every page of the web app as a polished SaaS-style product, replace the downloadable PDF application form (SAB / PTG `119000064-FM-002`) with an online multi-step application form with document uploads, add HR admin pages for users and jobs, and add richer job fields.

**Decided with the user (2026-10-04):** HR (`recruitment`) is the admin · SaaS dashboard look (left sidebar, white cards, one indigo accent) · job fields: department, employment type, salary range, headcount, closing date · public careers site (browse without login) · applicants fill the form on the web, no PDF download · work directly on `main` · SDD in parallel, Sonnet implements, **Opus** does the final review.

**Defaults I picked (user can override):** required fields = the `*` items of the user's pasted list, everything else from the PDF optional · staff-only PDF parts (uniform size, employee ID, สังกัด/unit, "สำหรับเจ้าหน้าที่") are dropped · signature = typed full name + PDPA consent checkbox · files stored in Postgres `bytea`, PDF/JPG/PNG only, 10 MB per file, 30 MB per submission · the form is stored per application (snapshot) and prefilled from the applicant's latest form · closed or past-closing-date jobs stay in `GET /jobs` (HR needs them) and the careers page filters them client-side; applying to them is blocked server-side.

---

## 1. Global constraints

- Work on branch `main` (user approved). Never push. Commit only your own paths: `git add <files> && git commit -m "..." -- <files>` (parallel agents share the tree; never `git add -A/.`, `stash`, `reset`, `checkout`, `restore`). On `index.lock`, wait and retry. Messages end with a blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Backend: Go via podman only (PowerShell; Git Bash mangles `/app`):
```powershell
$B = "C:\Users\sutth\Documents\GitHub\Recruitment_Backend\backend"
podman run --rm --pod recruitment -v "${B}:/app" -v recruitment-gomod:/go/pkg/mod -v recruitment-gobuild:/root/.cache/go-build -w /app docker.io/library/golang:1.27 sh -c "gofmt -l . ; go vet ./... && go build -o /tmp/app . && echo BUILD_OK"
podman run --rm --pod recruitment -e DB_NAME=recruitment_test -v "${B}:/app" -v recruitment-gomod:/go/pkg/mod -v recruitment-gobuild:/root/.cache/go-build -w /app docker.io/library/golang:1.27 go test ./... -count=1
podman restart recruitment-backend   # dev server (go run . on a read-only mount); poll curl -s localhost:8080/ until up
```
- Frontend: `frontend/my-app` (Next.js 16.3, React 19.2, Tailwind v4, shadcn style `radix-nova`, `radix-ui` umbrella installed). `next dev` is already running on :3000 — never start/stop it and never run `npm run build` (controller does). Read `node_modules/next/dist/docs/` before any unfamiliar Next API. Lint rule `react-hooks/set-state-in-effect` is ON (setState only in promise callbacks inside effects).
- New npm deps: only what `npx shadcn@latest add <component>` installs (expected: `sonner`), and only in Task 3. No other deps.
- All UI copy Thai. Never log or print passwords, tokens, `.env` values, or application-form contents.
- **Visual self-check is mandatory for every frontend task:** screenshot each page you built at desktop and mobile and Read the PNGs; fix anything that looks broken, cramped, misaligned, overflowing, or unpolished before reporting. Tool (no deps, uses Chrome):
```bash
S="C:/Users/sutth/AppData/Local/Temp/claude/C--Users-sutth-Documents-GitHub-Recruitment-Backend/18323645-3e83-41fa-9962-f5007ee277d4/scratchpad"
node "$S/shot.mjs" admin/jobs "$S/t5-admin-jobs.png" --as hr            # path WITHOUT leading slash
node "$S/shot.mjs" admin/jobs "$S/t5-admin-jobs-m.png" --as hr --width 375 --height 812
node "$S/shot.mjs" "" "$S/t4-home.png" --full                          # public page, full height
```
  `--as hr|applicant` logs in with the seed accounts (`hr@example.com` / `applicant@example.com`, password `1234`). The tool prints the final URL and any JS errors — both must be clean.

## 2. Design system

- **Look:** modern SaaS (Linear/Vercel-like). App background `slate-50`; content on white cards (`rounded-xl border bg-card shadow-xs`); generous spacing (page padding 24–32px desktop, 16px mobile); one accent **indigo** for primary actions/active nav/focus rings; neutral slate text (`text-slate-900` headings, `text-slate-500` secondary). No gradients except a subtle indigo tint in the careers hero and auth brand panel.
- **Tokens:** in `app/globals.css` set shadcn CSS vars: `--primary` = indigo-600 (`oklch(0.511 0.262 276.966)`), `--primary-foreground` white, `--ring` indigo-500, `--radius: 0.75rem`; keep the rest neutral (slate). Fix the broken circular `--font-sans: var(--font-sans)`.
- **Font:** a Thai-capable Google font via `next/font/google` (preferred `IBM_Plex_Sans_Thai`, weights 400/500/600/700, subsets `thai` + `latin`; verify the export name exists in this Next version, else `Noto_Sans_Thai`), exposed as `--font-sans` and applied to `body`. `lang="th"`.
- **Components:** shadcn/ui primitives in `components/ui/` added in Task 3 only: `button card input label textarea select badge table dialog alert-dialog dropdown-menu tabs sheet avatar separator skeleton tooltip checkbox radio-group progress sonner`. Native `<input type="date">` / `type="month"` for dates (styled like `Input`).
- **Shared app components** (`components/app/`, Task 3): `PublicShell` (top nav + footer), `AdminShell` (left sidebar 240px with logo "Recruit", nav ภาพรวม/ตำแหน่งงาน/ผู้สมัคร/ผู้ใช้, bottom user card + logout; on < `lg` the sidebar becomes a `Sheet` opened from a top bar), `PageHeader` (title, description, actions slot, optional breadcrumb), `EmptyState` (icon, title, text, action), `StatCard`, `StatusBadge` (application status, colored dot + label), `StatusStepper` (pending → screening → interview → passed, with rejected as a red terminal state; optional `onChange`), `ConfirmDialog` (AlertDialog wrapper, destructive variant), `LoadingState` (skeleton block), `ErrorState`, `FormField` (label + control + error text + required asterisk).
- **States:** every data view shows a skeleton while loading, an `EmptyState` when empty, and an `ErrorState` (with retry) when the load fails; mutations show a `sonner` toast on success/failure and disable their button while in flight. Destructive actions always go through `ConfirmDialog`.
- **Responsive:** must look right at 375px and 1440px; tables become stacked cards or scroll inside their card on mobile; no page-level horizontal scroll.
- **Formatting** (`lib/format.ts`, Task 3): `formatDate(iso)` → `toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })`; date-only strings parsed as local (`new Date(d + "T00:00")`); `formatMoney(n)` → `฿45,000`; `formatSalaryRange(min, max)` → `฿30,000 – ฿45,000` / `เริ่มต้น ฿30,000` / `ไม่ระบุ`; `initials(name)`.

## 3. Information architecture (routes)

Old routes are deleted in Task 3: `app/(applicant)/**`, `app/hr/**`, `components/app-ui.tsx`, `components/ui/clean-minimal-sign-in.tsx`, old `app/register`.

| Route | Who | Page |
|---|---|---|
| `/` | public | Careers: hero (title "ร่วมงานกับเรา", subtitle, search), filters (department, employment type, location), job cards (title, department, location, type badge, salary range, closing date, "ดูรายละเอียด"); only `status=open` and not past `closing_date` |
| `/jobs/[id]` | public | Job detail: header + meta (department, type, location, salary, headcount, closing date), description, requirement; sticky apply card: guest → "เข้าสู่ระบบเพื่อสมัคร" (`/login?next=/jobs/[id]/apply`), applicant → "สมัครงานนี้" (`/jobs/[id]/apply`) or "สมัครแล้ว" (→ `/me/applications`), HR → "จัดการตำแหน่งนี้" (`/admin/jobs/[id]`); closed/expired → disabled "ปิดรับสมัครแล้ว" |
| `/jobs/[id]/apply` | applicant | Application wizard (section 5) |
| `/login`, `/register` | public | Split layout: brand panel (indigo tint, logo, short pitch) + form card; `?next=` honoured; after login HR → `/admin`, applicant → `next` or `/me/applications`; register then auto-login |
| `/me/applications` | applicant | My applications: cards with job title, applied date, `StatusStepper` (read-only), upcoming interview (date/time), buttons "ดูใบสมัคร" (dialog/sheet with `FormViewer`) and "เอกสาร" (list + open) |
| `/admin` | HR | Dashboard: 4 `StatCard`s (ตำแหน่งที่เปิดรับ, ผู้สมัครทั้งหมด, รอสัมภาษณ์, ผ่านการคัดเลือก), pipeline bar (count per status), recent applications table (5 rows), open jobs list with applicant counts |
| `/admin/jobs` | HR | Jobs table: title, department, type, location, headcount, applicants, closing date, status; row actions menu (ดูผู้สมัคร, แก้ไข, เปิด/ปิดรับ, ลบ — confirm warns it deletes all its applications); "+ สร้างตำแหน่งงาน" |
| `/admin/jobs/new`, `/admin/jobs/[id]/edit` | HR | `JobForm`: sections ข้อมูลตำแหน่ง (title, department, employment type, location, headcount), ค่าตอบแทน (salary min/max), รายละเอียด (description, requirement), การรับสมัคร (status, closing date); inline validation |
| `/admin/jobs/[id]` | HR | Job header (meta + edit button) + Kanban pipeline (5 columns, drag & drop + select fallback, optimistic with rollback); card: name, applied date, expected salary (from form summary if present), link to detail |
| `/admin/applications` | HR | All applications table: search (name/email), status tabs, job select; columns name+email, job, applied date, status; row → detail |
| `/admin/applications/[id]` | HR | Header: name, job, applied date, `StatusStepper` with change; tabs **ใบสมัคร** (`FormViewer` + "พิมพ์" button using a print stylesheet), **เอกสาร** (list: type label, filename, size, open/download via blob), **การคัดเลือก** (screenings / interviews / work tests: list + add + edit, as today but in the new design), **บันทึก** (internal HR note) |
| `/admin/users` | HR | Users table: avatar initials, name, email, phone, role badge, row actions; search; role tabs (ทั้งหมด / HR / ผู้สมัคร); "+ เพิ่มผู้ใช้" dialog (name, email, phone, password, role); edit dialog (name, email, phone, role, new password optional); delete with confirm; the current HR's own row cannot be deleted or have its role changed (disabled + tooltip) |

Guards: `RequireRole` client component (Task 3) — no session → `/login?next=<current>`; wrong role → its home (`/admin` or `/`). A 401 from the API clears the session and redirects to `/login`.

## 4. API contract (backend changes)

**Jobs** (Task 1). New columns (via `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS …` in `schema.sql`):
`department TEXT NOT NULL DEFAULT ''`, `employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','internship'))`, `salary_min INT NULL CHECK (salary_min >= 0)`, `salary_max INT NULL CHECK (salary_max >= 0)`, `headcount INT NOT NULL DEFAULT 1 CHECK (headcount >= 1)`, `closing_date DATE NULL`.
JSON on every job response/request: `department`, `employment_type`, `salary_min` (number|null), `salary_max` (number|null), `headcount`, `closing_date` (`"YYYY-MM-DD"`|null). Create requires the old required fields; new ones optional with defaults; validation: enum, `salary_min <= salary_max` when both set, `headcount >= 1`, valid date → else 400 Thai message. PATCH partial as today (null clears salary/closing_date: use a "present + null" aware decode, e.g. `json.RawMessage` or `*NullableInt` with a `Set` flag). `POST /applications` → 400 "ตำแหน่งนี้ปิดรับสมัครแล้ว" also when `closing_date < current_date`. `DELETE /jobs/:id` (exists, HR) cascades applications, forms, documents.

**Admin users** (Task 1). `POST /admin/users` (HR) `{full_name, email, password, phone, role}` → 201 user (no password); role must be applicant|recruitment; duplicate email 409; password rules as `CreateUser` (≤ 72 bytes). HR `PATCH /users/:id` on **own** id with `role` → 400 "ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้"; HR `DELETE /users/:id` on own id → 400 "ไม่สามารถลบบัญชีของตัวเองได้".

**Application form + documents** (Task 2). New tables (in `schema.sql`, idempotent):
```sql
CREATE TABLE IF NOT EXISTS application_forms (
  application_id INT PRIMARY KEY REFERENCES applications(application_id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS application_documents (
  document_id SERIAL PRIMARY KEY,
  application_id INT NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INT NOT NULL,
  data BYTEA NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_documents_app_idx ON application_documents(application_id);
```
- `POST /applications` with `Content-Type: multipart/form-data` (applicant): parts `job_id` (text), `form` (JSON text, schema §6), files in parts named `doc_<type>` (types §6.9; `doc_certificate` and `doc_other` may repeat). Server: `http.MaxBytesReader` 30 MB total, 10 MB per file, ≤ 15 files; type detected with `http.DetectContentType` on the first 512 bytes — only `application/pdf`, `image/jpeg`, `image/png` (else 400 "ไฟล์ต้องเป็น PDF, JPG หรือ PNG"); too large → 400 "ไฟล์ใหญ่เกินไป (สูงสุด 10 MB)"; required form keys (§6 `*`) and required docs (`resume`, `education`) validated server-side → 400 with the missing field/doc named in Thai; job open + not expired; then ONE transaction inserts application (status `pending`, user from token, note ''), form (`consent_at = now()`), documents; unique violation → 409 "สมัครตำแหน่งนี้แล้ว". Response 201 = the application JSON. Sanitize `filename` (basename, strip control chars, ≤ 200 chars).
- Applicant `POST /applications` with JSON → 400 "กรุณากรอกใบสมัคร". HR keeps the JSON path (no form).
- `GET /applications/:id/form` (HR or owner) → `{ "data": {...}, "consent_at": "..." }`; 404 when not visible or none.
- `GET /applications/:id/documents` (HR or owner) → `[{document_id, doc_type, filename, content_type, size_bytes, uploaded_at}]` (no bytes).
- `GET /documents/:id` (HR or owner of its application) → raw bytes; headers `Content-Type` (stored detected type), `Content-Disposition: inline; filename*=UTF-8''<urlencoded>`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`; other users → 404.
- `GET /me/application-form` (applicant) → latest form `data` of the caller (by `created_at desc`) or 404 — for prefill.
- Never include form data or documents in `GET /applications` lists. Never log form contents or filenames' bytes.

## 5. Application wizard (`/jobs/[id]/apply`)

- Layout: `PublicShell`; left: job summary card + vertical step list with completion state (on mobile: compact progress bar + "ขั้นที่ n/8"); right: the current step in a card; footer buttons "ย้อนกลับ" / "ถัดไป" (validates the step) / on the last step "ส่งใบสมัคร".
- Steps (§6 sections): 1 ตำแหน่งที่สมัคร · 2 ข้อมูลส่วนตัว · 3 ที่อยู่และการติดต่อ · 4 ครอบครัว · 5 การศึกษา · 6 ทักษะ · 7 ประสบการณ์ทำงาน · 8 เอกสารและยืนยัน (other questions, documents, PDPA text from PDF page 2 summarised + consent checkbox, typed signature, review summary).
- Repeating groups (education, languages, computer skills, licenses, employment records) use "+ เพิ่ม" / remove row; conditional fields show only when relevant (e.g. spouse when married, detail inputs when a yes/no question is "มี", current job when has experience).
- Prefill: on load, `GET /me/application-form` → merge into empty form (job-specific fields `expected_salary`, `available_start_date` not prefilled). Draft autosave to `localStorage` key `apply-draft-<jobId>` every change, **excluding** `national_id`; cleared on submit and on logout. Files are not drafted.
- Submit builds `FormData` (`job_id`, `form` JSON, files) via `apiUpload`; success → full-page success state with links to `/me/applications` and `/`; errors → toast + scroll to the offending step.
- Already applied → page shows "คุณสมัครตำแหน่งนี้แล้ว" with link to `/me/applications`.

## 6. Application form schema (single source of truth)

Implemented in `frontend/my-app/lib/application-form.ts` (Task 3) as typed field definitions grouped by section (`key`, Thai `label`, `type`, `required`, `options` with Thai labels, `showIf`), plus `emptyForm()`, `validateStep(step, form)`, `validateAll(form)`, and option label maps; `FormViewer` and the wizard render from it. Backend (Task 2) keeps a Go list of the `*` keys and validates them. Keys are snake_case; `*` = required. Types: `text`, `textarea`, `date` (`YYYY-MM-DD`), `month` (`YYYY-MM`), `number`, `enum`, `bool`, list = array of objects.

**6.1 position — ตำแหน่งที่สมัคร** (job comes from the URL, shown read-only)
`expected_salary`* number > 0 · `available_start_date`* date · `work_upcountry` enum `no|sometimes|anywhere|region` (ไม่ได้/บางครั้ง/ได้ทั่วประเทศ/เฉพาะภาค) · `work_upcountry_region` text (showIf region) · `current_status` enum `unemployed|full_time|part_time` (ว่างงาน/มีงานประจำ/งานเสริม) · `job_source` enum `website|facebook|line|job_board|referral|other` · `job_source_other` text (showIf other) · `referrer_name`, `referrer_code` text (showIf referral)

**6.2 personal — ข้อมูลส่วนตัว**
`title_th`* enum `นาย|นาง|นางสาว` · `first_name_th`* · `last_name_th`* · `nickname` · `title_en` enum `Mr.|Mrs.|Miss` · `first_name_en` · `last_name_en` · `gender` enum `male|female` · `date_of_birth`* date (age shown computed) · `birth_province` · `blood_type` enum `A|B|AB|O` · `religion` · `nationality` · `race` · `national_id` text (13 digits, checksum validated when filled) · `id_issued_at` · `id_issue_province` · `id_issue_date` date · `id_expiry_date` date · `military_status` enum `completed|exempted|not_applicable` (ผ่านการเกณฑ์แล้ว/ได้รับการยกเว้น/ไม่เกี่ยวข้อง) · `height_cm` number · `weight_kg` number

**6.3 contact — ที่อยู่และการติดต่อ**
`present_address`* textarea · `present_province`* · `residence_type` enum `own|parents|rental|dormitory|other` (บ้านตนเอง/บ้านบิดา-มารดา/บ้านเช่า/หอพัก/อื่นๆ) · `mobile_phone`* (9–10 digits) · `home_phone` · `email`* · `line_id` · `emergency_name` · `emergency_relationship` · `emergency_phone`

**6.4 family — ครอบครัว**
`father_name` · `father_status` enum `alive|deceased` · `father_age` number · `father_occupation` · `father_phone` · same five for `mother_*` · `parents_address` textarea · `marital_status` enum `single|married|divorced|widowed` · `spouse_name`, `spouse_status`, `spouse_age`, `spouse_occupation`, `spouse_phone` (showIf married) · `children_count` number · `siblings_count` number

**6.5 education — การศึกษา**
`education`* list (≥ 1): `{ level* enum primary|lower_secondary|upper_secondary|vocational_cert|diploma|bachelor|master_or_higher (ประถมศึกษา/มัธยมศึกษาตอนต้น/มัธยมศึกษาตอนปลาย/ปวช./ปวส.-อนุปริญญา/ปริญญาตรี/ปริญญาโทขึ้นไป), institute*, province, year_from (number), year_to* (number, ปีที่จบ พ.ศ. or ค.ศ. as typed), degree* (วุฒิการศึกษา), major* (คณะ/สาขา), gpa (number 0–4) }` · `education_status` enum `not_studying|studying` · `studying_major`, `studying_institute` (showIf studying) · `activities` textarea · `training` textarea

**6.6 skills — ทักษะ**
`relevant_skills`* textarea · `languages` list `{ language, listening, speaking, reading, writing }` (ratings 1–3: พอใช้/ดี/ดีมาก; default one row `ภาษาอังกฤษ`) · `computer_skills` list `{ name, level 1–3 }` (default rows `Microsoft Office`, `ERP`) · `driving_licenses` list `{ type enum car|motorcycle|truck, license_no }` · `other_achievements` textarea · `hobbies` · `sports`

**6.7 experience — ประสบการณ์ทำงาน**
`has_work_experience`* bool · `years_of_experience`* number ≥ 0 · `current_job` (showIf has experience) `{ employer, business_type, address, phone, start_date (date), first_position, current_position, job_description, reason_for_leaving, salary_start, salary_current, allowance, commission, other_income (numbers) }` · `employment_records` list `{ from (month), to (month), employer, position, salary (number), reason_for_leaving }`

**6.8 questions & consent — คำถามเพิ่มเติมและการยืนยัน**
`criminal_record` bool + `criminal_record_detail` · `credit_bureau_normal` bool (default true) + `credit_bureau_detail` (showIf false) · `chronic_disease` bool + `chronic_disease_detail` · `relatives_in_company` bool + `relatives_detail` · `social_security` enum `has|none_or_expired` · `social_security_hospital` · `pdpa_consent`* must be `true` · `signature_name`* text (must equal `first_name_th + " " + last_name_th`, whitespace-insensitive)

**6.9 documents** (files, not in JSON) — `doc_type` / Thai label / required:
`resume` Resume / CV * · `education` เอกสารวุฒิการศึกษา / Transcript * · `id_card` สำเนาบัตรประชาชน · `house_registration` สำเนาทะเบียนบ้าน · `work_certificate` หนังสือรับรองการทำงาน · `payslip` สลิปเงินเดือนล่าสุด · `certificate` ใบรับรอง/ใบอบรม (repeatable) · `marriage_certificate` ทะเบียนสมรส · `name_change` หลักฐานการเปลี่ยนชื่อ-สกุล · `military` สด.9 / สด.43 · `driving_license` ใบขับขี่ · `other` อื่นๆ (repeatable)

## 7. Review focus

1. Applicant A reading B's form, documents list or document bytes → 404. (Task 2 tests + E2E)
2. Upload abuse: wrong magic bytes with a `.pdf` name, > 10 MB, > 15 files, missing required docs → 400, nothing inserted. (Task 2)
3. Wizard data loss: back/next keeps values; refresh restores the draft (minus national ID); prefill doesn't overwrite what the user typed. (Task 8)
4. Every page at 375px: no horizontal scroll, sidebar collapses, tables usable. (all frontend tasks, screenshots)
5. HR locking themselves out (delete/demote own account) → blocked in API and UI. (Tasks 1, 7)

---

## 8. Tasks

Order: **Task 1 → Task 2** sequential (both edit `backend/handlers`). **Task 3** runs in parallel with Task 1. **Tasks 4–8** run in parallel after Task 3 (and may start before Task 2 finishes; their contract is §4/§6). **Task 9** is the controller's integration + Opus final review.

### Task 1: Backend — job fields + admin users

**Files:** Modify `backend/database/schema.sql`, `backend/models/job.go`, `backend/handlers/jobs.go`, `backend/handlers/applications.go` (closing-date check only), `backend/handlers/users.go`, `backend/routes/routes.go`; Create `backend/tests/jobs_admin_test.go`.

- [ ] TDD tests (`jobs_admin_test.go`): create job with all new fields → returned; omitted → defaults (`full_time`, headcount 1, nulls); invalid `employment_type` → 400; `salary_min > salary_max` → 400; `headcount 0` → 400; PATCH `{"closing_date": null}` clears it, PATCH `{"department":"IT"}` keeps others; apply to job with `closing_date` yesterday → 400; `POST /admin/users` by HR with role recruitment → 201 and that user can log in with role recruitment; by applicant → 403; duplicate email → 409; HR PATCH own role → 400; HR DELETE self → 400; HR DELETE other → 200.
- [ ] Implement §4 Jobs + Admin users. `jobs.go` select/scan all new columns everywhere (list, by id, create/patch RETURNING).
- [ ] gofmt/vet/build clean; all backend tests pass; `podman restart recruitment-backend`; `curl -s localhost:8080/jobs` shows the new fields.
- [ ] Commit `feat(backend): job details fields and admin user management`.

### Task 2: Backend — application form + documents

**Files:** Modify `backend/database/schema.sql`, `backend/handlers/applications.go`, `backend/routes/routes.go`, `backend/main.go` or `routes` (Gin `MaxMultipartMemory`); Create `backend/handlers/forms.go` (form validation, multipart create, form/doc read endpoints), `backend/models/form.go`, `backend/tests/forms_test.go`.

- [ ] TDD tests (`forms_test.go`, build multipart bodies in-test; small PDF = `%PDF-1.4\n...` bytes, PNG = PNG magic): applicant submit with form + resume + education → 201, rows in all three tables; missing `first_name_th` → 400 naming it; missing `doc_education` → 400; `doc_resume` with text bytes named `cv.pdf` → 400; 11 MB file → 400 (nothing inserted — check counts); duplicate submit → 409; applicant JSON POST → 400; HR JSON POST still 201; owner GET form/documents/document → 200 with correct `Content-Type`, `X-Content-Type-Options: nosniff`; other applicant → 404 on all three; HR → 200; `GET /me/application-form` returns the latest; deleting the job removes forms and documents (cascade); `GET /applications` list contains no `data`.
- [ ] Implement §4 form/document contract; required keys from §6 (`*`), including `education` list items' required subfields, `pdpa_consent == true`, `signature_name` matches name.
- [ ] gofmt/vet/build clean; all backend tests pass; restart backend; curl smoke with a multipart submit as `applicant@example.com` (job 2) then fetch its documents list.
- [ ] Commit `feat(backend): online application form with document uploads`.

### Task 3: Frontend foundation — design system, shells, shared libs, schema, viewer

**Files:** Modify `app/globals.css`, `app/layout.tsx`, `lib/api.ts`, `lib/types.ts`, `lib/lib.test.ts`, `package.json`/lockfile (shadcn only); Create `components/ui/*` (shadcn add), `components/app/{public-shell,admin-shell,page-header,empty-state,stat-card,status-badge,status-stepper,confirm-dialog,states,form-field,require-role}.tsx`, `components/application/form-viewer.tsx`, `lib/format.ts`, `lib/application-form.ts`, `lib/application-form.test.ts`, `app/admin/layout.tsx` (AdminShell inside RequireRole recruitment — Task 3 owns it), stub `app/admin/page.tsx`, stub `app/page.tsx`; Delete the old routes/components listed in §3.

- [ ] `npx shadcn@latest add` the §2 component list (non-interactive flags; keep `components.json` style). Theme tokens + font per §2; fix `--font-sans`.
- [ ] `lib/api.ts`: keep `api`, `ApiError`, `setSession`, `logout`, `useUser`; add `apiUpload<T>(path, formData)` (no JSON content type; Bearer header; same error handling), `fetchBlob(path)` → `Blob` with Bearer, `openDocument(id, filename)` (blob → object URL → new tab; revoke later). 401 → `logout()` and `window.location.assign("/login")` (only when not already on `/login`). Clear `apply-draft-*` keys in `logout()`.
- [ ] `lib/types.ts`: `Job` adds §4 fields; `EMPLOYMENT_TYPE_LABEL` (`full_time` เต็มเวลา, `part_time` พาร์ทไทม์, `contract` สัญญาจ้าง, `internship` ฝึกงาน); `ApplicationDocument` type; `DOC_TYPES` with Thai labels + required flags (§6.9).
- [ ] `lib/application-form.ts` + tests (node --test): §6 definitions; `emptyForm()`; `validateStep`/`validateAll` (required, enums, national ID checksum, phone, email, signature match, ≥1 education row); tests cover each rule.
- [ ] `components/app/*` per §2; `RequireRole` per §3 guards; `FormViewer` renders a submitted form by sections (label/value grid, lists as small tables, enum values as Thai labels, empty optional fields hidden) and has print-friendly classes.
- [ ] Delete old routes/components; `/` = temporary stub using `PublicShell`; `/admin` stub page under the admin layout so shells can be screenshotted. Public pages wrap themselves in `PublicShell` (no shared public layout file).
- [ ] `npm test`, `npx eslint .`, `npx tsc --noEmit` clean; screenshot `/` and `/admin` (desktop + 375) and Read them — shells must look polished.
- [ ] Commit `feat(frontend): design system, app shells, application form schema`.

### Task 4: Public site — careers, job detail, auth, my applications

**Files:** Create/replace `app/page.tsx`, `app/jobs/[id]/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, `app/me/applications/page.tsx` (+ small local components in `components/public/`).

- [ ] Build per §3 rows `/`, `/jobs/[id]`, `/login`, `/register`, `/me/applications` (FormViewer in a Sheet/Dialog; documents via `openDocument`). Careers filters are client-side; hide closed/expired jobs.
- [ ] Lint/tsc/test clean; screenshots desktop + 375 of all five pages (`me/applications --as applicant`, `login`, `register`, `""`, `jobs/1`) — Read and polish.
- [ ] Commit `feat(frontend): careers site, job detail, auth, my applications`.

### Task 5: Admin — dashboard, applications list, application detail

**Files:** Replace `app/admin/page.tsx`; Create `app/admin/applications/page.tsx`, `app/admin/applications/[id]/page.tsx` (+ local components in `components/admin/applications/`).

- [ ] Build per §3 rows `/admin`, `/admin/applications`, `/admin/applications/[id]` (tabs ใบสมัคร/เอกสาร/การคัดเลือก/บันทึก; keep today's payload rules for status/note/screenings/interviews/work tests; print button prints only the form).
- [ ] Lint/tsc/test clean; screenshots desktop + 375 (`admin`, `admin/applications`, an application detail with a form — create one via the API if none) — Read and polish.
- [ ] Commit `feat(frontend): admin dashboard and applications`.

### Task 6: Admin — jobs

**Files:** Create `app/admin/jobs/page.tsx`, `app/admin/jobs/new/page.tsx`, `app/admin/jobs/[id]/page.tsx`, `app/admin/jobs/[id]/edit/page.tsx`, `components/admin/jobs/{job-form,job-pipeline}.tsx`. (Do not edit `app/admin/layout.tsx` — Task 3 owns it.)

- [ ] Build per §3 rows `/admin/jobs`, `/admin/jobs/new`, `/admin/jobs/[id]/edit`, `/admin/jobs/[id]` (Kanban: optimistic move + rollback + per-card lock + select fallback, as before).
- [ ] Lint/tsc clean; screenshots desktop + 375 of list, new, edit, pipeline — Read and polish.
- [ ] Commit `feat(frontend): admin job management and pipeline`.

### Task 7: Admin — users

**Files:** Create `app/admin/users/page.tsx`, `components/admin/users/{user-dialog,users-table}.tsx`.

- [ ] Build per §3 row `/admin/users` using `GET /users`, `POST /admin/users`, `PATCH /users/:id`, `DELETE /users/:id`; own row locked (UI) and API errors toasted.
- [ ] Lint/tsc clean; screenshots desktop + 375 (`admin/users --as hr`, plus the add dialog open if feasible via a `?new=1` param you add) — Read and polish.
- [ ] Commit `feat(frontend): admin user management`.

### Task 8: Application wizard

**Files:** Create `app/jobs/[id]/apply/page.tsx`, `components/application/{wizard,step-*,repeatable-list,file-drop}.tsx` (split by step; keep each file focused).

- [ ] Build §5 using `lib/application-form.ts` definitions; `FileDrop` per doc type (drag & drop + click, shows name/size, remove, client-side type/size check mirroring §4); submit via `apiUpload`.
- [ ] Lint/tsc/test clean; screenshots desktop + 375 of steps 1, 5, 8 (`jobs/2/apply --as applicant`) — Read and polish. If Task 2 has landed, submit a real application once (job 2) and confirm it appears in `/me/applications`.
- [ ] Commit `feat(frontend): online application wizard`.

### Task 9: Integration + final review (controller)

- [ ] Restart backend; full Go tests; frontend `npm test`, lint, `npm run build` (then check :3000 is still up; restart `npm run dev` if not).
- [ ] Extend the E2E script: multipart submit with documents; missing required doc 400; wrong file type 400; other applicant fetching the document 404; HR 200; job delete cascades forms/docs; admin user create/delete; self-delete 400.
- [ ] Screenshot every route (desktop + 375) for the final reviewer.
- [ ] Final whole-change review on **Opus**; one fix wave; scoped re-review; commit.
