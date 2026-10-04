# Recruitment Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Odoo-Recruitment-style frontend (HR + applicant) in `frontend/my-app` on top of the existing, unmodified Go backend.

**Architecture:** Next.js 16 App Router, all pages are Client Components calling the backend directly from the browser (`fetch` via one `api()` helper). Logged-in user lives in `localStorage`, read with `useSyncExternalStore`. Role layouts (`RoleGate`) redirect wrong/missing users to `/`. Kanban uses native HTML5 drag & drop plus a `<select>` fallback.

**Tech Stack:** Next.js 16.3, React 19.2, Tailwind v4, lucide-react, existing `components/ui/button.tsx`. Tests: `node --test` (Node 26 strips TS types natively). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-04-recruitment-frontend-design.md`

## Global Constraints

- Only touch `frontend/my-app/**` and these docs. **Never modify `backend/`.**
- No new npm dependencies.
- All UI copy in Thai. Odoo-like layout, but no Odoo logo/brand colors. Primary = `bg-gray-900 text-white` (matches existing sign-in).
- Read Next 16 docs in `node_modules/next/dist/docs/` before using an unfamiliar Next API (see `frontend/my-app/AGENTS.md`). Dynamic params in client pages: `const { id } = useParams<{ id: string }>()` from `next/navigation`.
- Lint rule `react-hooks/set-state-in-effect` is ON: never call setState synchronously in an effect body. Allowed: setState inside `.then()/.catch()` of a promise started in the effect. Use the **data-loading pattern** below.
- Backend base URL: `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"`. Backend CORS only allows `http://localhost:3000`.
- Backend quirks to respect (from spec): list endpoints may return `null` → always `?? []`; `PATCH /jobs` overwrites every field → send the full job; `PATCH /applications` needs `status` and send the current `note`; `PATCH /interviews` needs `interview_date`, `interview_time`, `status`; `POST /work-tests` `test_date` must be ISO (`new Date(d).toISOString()`); `/screenings`, `/interviews`, `/work-tests` cannot be filtered → fetch all, filter by `application_id` client-side; `/applications` has no names → join with `/users`.
- `POST /login` does not exist yet in backend (404). Frontend still calls it (spec decision).
- Do not commit. The controller handles git.

### Data-loading pattern (use in every page)

```tsx
const [data, setData] = useState<{ jobs: Job[] } | null>(null)
const [error, setError] = useState("")
const [tick, setTick] = useState(0)
const reload = () => setTick((t) => t + 1)

useEffect(() => {
  api<Job[] | null>("/jobs")
    .then((jobs) => setData({ jobs: jobs ?? [] }))
    .catch((e: Error) => setError(e.message))
}, [tick])

if (!data) return error ? <ErrorText message={error} /> : <Loading />
```

Mutations: `setError("")`, `await api(...)`, then `reload()`; on catch `setError(e.message)`. Disable the submit button while a mutation is in flight.

### Shared UI conventions
- Page wrapper is provided by `RoleGate` (`bg-gray-50`, `max-w-6xl mx-auto p-4`).
- Card: `rounded-xl border border-gray-200 bg-white p-4 shadow-sm`.
- Inputs: `inputClass` from `components/app-ui.tsx`.
- Buttons: `Button` from `@/components/ui/button` (variants `default`, `outline`, `ghost`, `destructive`).
- Status badge: `<span className={`rounded-full px-2 py-0.5 text-xs ${APP_STATUS_COLOR[s]}`}>{APP_STATUS_LABEL[s]}</span>`.
- Dates: `new Date(x).toLocaleDateString("th-TH")`; interview time display `t.slice(0, 5)`.
- Must work at 375px width: no page-level horizontal scroll (Kanban scrolls inside its own container).

## Review Focus

1. Backend down / network error → every page shows "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", never a blank screen or crash. (Task 1 test)
2. Empty DB (lists return `null`) → empty-state text, no `.map` of null. (Task 1 `?? []` + each page's empty state)
3. `POST /login` returns 404 (non-JSON body) → login shows a clear Thai message about backend missing `/login`. (Task 1 test for 404 fallback + Task 2)
4. Corrupt or missing `localStorage.user`, or applicant opening `/hr/...` → redirected to `/`, no crash. (Task 1 `useUser` + `RoleGate`)
5. Kanban PATCH fails → card returns to its original column with error shown; dropping in the same column sends no request. (Task 4)

---

### Task 1: Foundation (types, api, shared UI, layouts)

**Files:**
- Create: `frontend/my-app/lib/types.ts`, `frontend/my-app/lib/api.ts`, `frontend/my-app/lib/lib.test.ts`, `frontend/my-app/components/app-ui.tsx`, `frontend/my-app/app/hr/layout.tsx`, `frontend/my-app/app/(applicant)/layout.tsx`
- Modify: `frontend/my-app/app/layout.tsx`, `frontend/my-app/app/page.tsx`, `frontend/my-app/tsconfig.json`, `frontend/my-app/package.json`
- Delete: `frontend/my-app/components/demo.tsx`

**Interfaces:**
- Produces (`@/lib/types`): types `Role`, `AppStatus`, `Result`, `InterviewStatus`, `User`, `Job`, `Application`, `Screening`, `Interview`, `WorkTest`; consts `APP_STATUSES`, `APP_STATUS_LABEL`, `APP_STATUS_COLOR`, `JOB_STATUS_LABEL`, `RESULT_LABEL`, `INTERVIEW_STATUS_LABEL`; fns `groupByStatus(apps): Record<AppStatus, Application[]>`, `countByStatus(apps): Record<AppStatus, number>`.
- Produces (`@/lib/api`): `api<T>(path: string, opts?: { method?: string; body?: unknown }): Promise<T>`, `class ApiError extends Error { status: number }` (status 0 = network), `setUser(u: User): void`, `logout(): void`, `useUser(): User | null | undefined` (undefined = not read yet).
- Produces (`@/components/app-ui`): `inputClass: string`, `Loading()`, `ErrorText({ message })`, `StatusBar({ value: AppStatus, onChange?: (s: AppStatus) => void })` (read-only when no `onChange`), `RoleGate({ role, links, children })`.

- [ ] **Step 1: Write the failing test** — `frontend/my-app/lib/lib.test.ts`

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { countByStatus, groupByStatus, type Application } from "./types.ts"
import { api } from "./api.ts"

const app = (id: number, status: Application["status"]): Application => ({
  application_id: id, user_id: 1, job_id: 1, apply_date: "", status, note: "",
})

test("countByStatus counts each status, zero when missing", () => {
  assert.deepEqual(countByStatus([app(1, "pending"), app(2, "pending"), app(3, "passed")]), {
    pending: 2, screening: 0, interview: 0, passed: 1, rejected: 0,
  })
})

test("groupByStatus ignores unknown status", () => {
  const g = groupByStatus([app(1, "interview"), app(2, "weird" as Application["status"])])
  assert.equal(g.interview.length, 1)
  assert.equal(Object.values(g).flat().length, 1)
})

test("api: network failure -> Thai message, status 0", async () => {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch") }
  await assert.rejects(api("/jobs"), { message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", status: 0 })
})

test("api: backend JSON error is surfaced with status", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 })
  await assert.rejects(api("/login", { method: "POST", body: {} }), { message: "Invalid email or password", status: 401 })
})

test("api: non-JSON 404 falls back to generic message", async () => {
  globalThis.fetch = async () => new Response("404 page not found", { status: 404 })
  await assert.rejects(api("/login"), { message: "เกิดข้อผิดพลาด (404)", status: 404 })
})

test("api: null body on 200 resolves null", async () => {
  globalThis.fetch = async () => new Response("null", { status: 200 })
  assert.equal(await api("/jobs"), null)
})

test("api: sends JSON body and method", async () => {
  let seen: RequestInit | undefined
  globalThis.fetch = async (_url, init) => { seen = init; return new Response("{}", { status: 200 }) }
  await api("/jobs", { method: "POST", body: { a: 1 } })
  assert.equal(seen?.method, "POST")
  assert.equal(seen?.body, '{"a":1}')
})
```

Add to `package.json` scripts: `"test": "node --test lib/*.test.ts"`.
Add to `tsconfig.json` `compilerOptions`: `"allowImportingTsExtensions": true` (needed because the test imports `./types.ts`; `noEmit` is already true).

- [ ] **Step 2: Run test to verify it fails**

Run (in `frontend/my-app`): `npm test`
Expected: FAIL — cannot find module `./types.ts`.

- [ ] **Step 3: Write `lib/types.ts`**

```ts
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
```

- [ ] **Step 4: Write `lib/api.ts`**

```ts
import { useMemo, useSyncExternalStore } from "react"
import type { User } from "./types.ts"

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? "GET",
      headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } catch {
    throw new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", 0)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(data?.error ?? `เกิดข้อผิดพลาด (${res.status})`, res.status)
  return data as T
}

const KEY = "user"

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

// storage event only fires cross-tab; fire it ourselves for this tab
function notify() {
  window.dispatchEvent(new Event("storage"))
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb)
  return () => window.removeEventListener("storage", cb)
}

export function setUser(user: User) {
  try {
    localStorage.setItem(KEY, JSON.stringify(user))
  } catch {
    // storage blocked: user stays logged out
  }
  notify()
}

export function logout() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing stored
  }
  notify()
}

/** undefined = not read yet (server render), null = not logged in */
export function useUser(): User | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, read, () => undefined)
  return useMemo(() => {
    if (raw === undefined) return undefined
    try {
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  }, [raw])
}
```

If Node cannot import `react` named exports from the test, move the session code (`read`…`useUser`) into `lib/session.ts`, keep `api`/`ApiError` in `lib/api.ts`, and update the Produces list in your report.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: 7 tests pass.

- [ ] **Step 6: Write `components/app-ui.tsx`**

```tsx
"use client"

import { useEffect, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { logout, useUser } from "@/lib/api"
import { APP_STATUSES, APP_STATUS_LABEL, type AppStatus, type Role } from "@/lib/types"

export const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"

export function Loading() {
  return <p className="p-6 text-sm text-gray-500">กำลังโหลด...</p>
}

export function ErrorText({ message }: { message: string }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
      {message}
    </p>
  )
}

export function StatusBar({ value, onChange }: { value: AppStatus; onChange?: (s: AppStatus) => void }) {
  return (
    <div className="flex w-fit max-w-full flex-wrap overflow-hidden rounded-lg border border-gray-200 bg-white text-xs sm:text-sm">
      {APP_STATUSES.map((s) => {
        const active = s === value
        const activeClass = s === "rejected" ? "bg-red-600 text-white" : "bg-gray-900 text-white"
        return (
          <button
            key={s}
            type="button"
            disabled={!onChange || active}
            aria-current={active ? "step" : undefined}
            onClick={() => onChange?.(s)}
            className={`border-r border-gray-200 px-3 py-1.5 last:border-r-0 ${active ? activeClass : "text-gray-600 enabled:hover:bg-gray-50"}`}
          >
            {APP_STATUS_LABEL[s]}
          </button>
        )
      })}
    </div>
  )
}

type NavLink = { href: string; label: string }

export function RoleGate({ role, links, children }: { role: Role; links: NavLink[]; children: ReactNode }) {
  const user = useUser()
  const router = useRouter()
  const allowed = user?.role === role

  useEffect(() => {
    if (user !== undefined && !allowed) router.replace("/")
  }, [user, allowed, router])

  if (!user || user.role !== role) return <Loading />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <span className="font-semibold">Recruitment</span>
          <nav className="flex gap-3 text-sm text-gray-600">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-gray-900">
                {l.label}
              </Link>
            ))}
          </nav>
          <span className="ml-auto hidden text-sm text-gray-500 sm:inline">{user.full_name}</span>
          <button
            type="button"
            onClick={() => {
              logout()
              router.replace("/")
            }}
            className="ml-auto flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 sm:ml-0"
          >
            <LogOut className="size-4" /> ออกจากระบบ
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  )
}
```

- [ ] **Step 7: Layouts and root cleanup**

`app/hr/layout.tsx`:
```tsx
import type { ReactNode } from "react"
import { RoleGate } from "@/components/app-ui"

export default function HrLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate role="recruitment" links={[{ href: "/hr/jobs", label: "ตำแหน่งงาน" }]}>
      {children}
    </RoleGate>
  )
}
```

`app/(applicant)/layout.tsx`:
```tsx
import type { ReactNode } from "react"
import { RoleGate } from "@/components/app-ui"

export default function ApplicantLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate
      role="applicant"
      links={[
        { href: "/jobs", label: "งานที่เปิดรับ" },
        { href: "/my-applications", label: "งานที่ฉันสมัคร" },
      ]}
    >
      {children}
    </RoleGate>
  )
}
```

`app/layout.tsx`: change `lang="en"` → `lang="th"`, metadata → `title: "Recruitment"`, `description: "ระบบรับสมัครงาน"`. Nothing else.

`app/page.tsx` (replace whole file), then delete `components/demo.tsx`:
```tsx
import { SignIn2 } from "@/components/ui/clean-minimal-sign-in"

export default function Page() {
  return <SignIn2 />
}
```

- [ ] **Step 8: Verify**

Run: `npm test` → 7 pass. `npx eslint lib components/app-ui.tsx app` → 0 errors. `npx tsc --noEmit` → 0 errors.

---

### Task 2: Login + Register

**Files:**
- Modify: `frontend/my-app/components/ui/clean-minimal-sign-in.tsx`
- Create: `frontend/my-app/app/register/page.tsx`

**Interfaces:**
- Consumes: `api`, `ApiError`, `setUser` from `@/lib/api`; `User` from `@/lib/types`; `inputClass`, `ErrorText` from `@/components/app-ui`.

**Login (`clean-minimal-sign-in.tsx`)** — keep the existing card look and Thai copy; change behaviour:
- Wrap inputs + button in `<form onSubmit>` (Enter submits); button `type="submit"`, disabled while submitting, label "กำลังเข้าสู่ระบบ..." while busy.
- Keep the existing empty-field and email-regex validation.
- Submit:
```tsx
try {
  const user = await api<User>("/login", { method: "POST", body: { email, password } })
  setUser(user)
  router.replace(user.role === "recruitment" ? "/hr/jobs" : "/jobs")
} catch (e) {
  const status = e instanceof ApiError ? e.status : -1
  setError(
    status === 404 ? "ระบบเข้าสู่ระบบยังไม่พร้อม (backend ยังไม่มี POST /login)"
    : status === 401 ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
    : (e as Error).message,
  )
}
```
- Remove: the `alert`, unused imports (`React`, `LogIn`), the commented-out icon block, the empty `<span>` after the password input, and the "ลืมรหัสผ่าน?" button (no backend support).
- Show `<ErrorText message={error} />` above the submit button.
- Below the button: `ยังไม่มีบัญชี? <Link href="/register">สมัครสมาชิก</Link>`.

**Register (`app/register/page.tsx`)** — `"use client"`, same card styling as login (`max-w-sm` gradient card centered):
- Fields (all `required`, `inputClass`): ชื่อ-นามสกุล (`full_name`), อีเมล (`type="email"`), รหัสผ่าน (`type="password"`), เบอร์โทร (`type="tel"`).
- Submit: `await api<User>("/users", { method: "POST", body: { ...form, role: "applicant" } })`, then render success state: "สมัครสมาชิกสำเร็จ" + `<Link href="/">เข้าสู่ระบบ</Link>`.
- Error: if message contains `duplicate` → "อีเมลนี้ถูกใช้แล้ว", else the message.
- Link back: "มีบัญชีแล้ว? เข้าสู่ระบบ" → `/`.

- [ ] Implement both files.
- [ ] Verify: `npx eslint components/ui/clean-minimal-sign-in.tsx app/register` → 0 errors; `npx tsc --noEmit 2>&1 | grep -E "sign-in|register"` → nothing.
- [ ] Verify against live backend: `curl -s -X POST localhost:8080/users -H "Content-Type: application/json" -d '{"full_name":"t","email":"t'$RANDOM'@example.com","password":"1","phone":"1","role":"applicant"}'` returns a user JSON (proves the payload shape). `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:8080/login` → `404` (expected today).

---

### Task 3: HR job positions (`/hr/jobs`)

**Files:**
- Create: `frontend/my-app/app/hr/jobs/page.tsx`

**Interfaces:**
- Consumes: `api`, `useUser` (`@/lib/api`); `Job`, `Application`, `countByStatus`, `APP_STATUSES`, `APP_STATUS_LABEL`, `APP_STATUS_COLOR`, `JOB_STATUS_LABEL` (`@/lib/types`); `Loading`, `ErrorText`, `inputClass` (`@/components/app-ui`); `Button`.

Behaviour:
- Load (data-loading pattern): `Promise.all([api<Job[] | null>("/jobs"), api<Application[] | null>("/applications")])` → `jobs ?? []`, `apps ?? []`.
- Header row: `<h1>ตำแหน่งงาน</h1>` + `Button` "สร้างตำแหน่งงาน" (opens the form in create mode).
- Form (inline card above the grid, not a modal): title (ชื่อตำแหน่ง), location (สถานที่), description (รายละเอียดงาน, textarea), requirement (คุณสมบัติ, textarea), status select (`open`/`closed` with `JOB_STATUS_LABEL`); all required; buttons บันทึก / ยกเลิก.
  - Create: `api("/jobs", { method: "POST", body: { ...form, created_by: user.user_id } })`.
  - Edit: `api(`/jobs/${job.job_id}`, { method: "PATCH", body: { ...form, created_by: job.created_by } })` — always the full object.
  - On success close form + `reload()`.
- Grid `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` of job cards:
  - Title as `Link` to `/hr/jobs/${job_id}`, location, status badge (open `bg-green-100 text-green-700`, closed `bg-gray-100 text-gray-600`).
  - Odoo-style primary call-out: `Button` linking to `/hr/jobs/${job_id}`: "ผู้สมัครใหม่ {pending}" .
  - Small row of per-status counts: for each of `APP_STATUSES`, badge `APP_STATUS_COLOR` with `APP_STATUS_LABEL` + count (from `countByStatus(apps.filter(a => a.job_id === job.job_id))`).
  - Actions: "แก้ไข" (opens form prefilled), "ปิดรับ"/"เปิดรับ" toggle → PATCH with full job and flipped status.
- Empty state: "ยังไม่มีตำแหน่งงาน".
- No delete button (DELETE cascades applications; out of scope).

- [ ] Implement.
- [ ] Verify: `npx eslint app/hr/jobs/page.tsx` → 0 errors; `npx tsc --noEmit 2>&1 | grep "app/hr/jobs/page"` → nothing.
- [ ] Verify payload shape against live backend: `curl -s -X PATCH localhost:8080/jobs/3 -H "Content-Type: application/json" -d '{"title":"HR Officer","description":"ดูแลงานสรรหาบุคลากร","requirement":"ปริญญาตรีสาขาที่เกี่ยวข้อง","location":"เชียงใหม่","status":"closed","created_by":1}'` returns the job.

---

### Task 4: HR Kanban (`/hr/jobs/[id]`)

**Files:**
- Create: `frontend/my-app/app/hr/jobs/[id]/page.tsx`

**Interfaces:**
- Consumes: `api` (`@/lib/api`); `Job`, `Application`, `User`, `AppStatus`, `APP_STATUSES`, `APP_STATUS_LABEL`, `APP_STATUS_COLOR`, `JOB_STATUS_LABEL`, `groupByStatus` (`@/lib/types`); `Loading`, `ErrorText` (`@/components/app-ui`).

Behaviour:
- `const { id } = useParams<{ id: string }>()`.
- Load: `Promise.all([api<Job>(`/jobs/${id}`), api<Application[] | null>(`/applications?job_id=${id}`), api<User[] | null>("/users")])`. Keep `apps` in its own state (needed for optimistic moves); build `Map<number, User>` from users.
- Header: `Link` "← ตำแหน่งงาน" to `/hr/jobs`, job title (h1), location, job status badge.
- Board: `<div className="flex gap-3 overflow-x-auto pb-2">`; one column per `APP_STATUSES` (`w-64 shrink-0 rounded-xl bg-gray-100 p-2`), header = label + count; column highlights (`ring-2 ring-sky-300`) while a card is dragged over it.
- Card (`draggable`, `rounded-lg bg-white p-3 shadow-sm border`): name (`users.get(user_id)?.full_name ?? `ผู้สมัคร #${user_id}``) as `Link` to `/hr/applications/${application_id}`, email, apply date, note (truncate, `line-clamp-2`), and a small `<select aria-label="เปลี่ยนสถานะ">` of statuses (touch/keyboard fallback for drag).
- One move function used by drop and select:
```tsx
async function move(app: Application, status: AppStatus) {
  if (app.status === status) return
  const prev = app.status
  setApps((list) => list.map((a) => (a.application_id === app.application_id ? { ...a, status } : a)))
  setError("")
  try {
    await api(`/applications/${app.application_id}`, { method: "PATCH", body: { status, note: app.note } })
  } catch (e) {
    setApps((list) => list.map((a) => (a.application_id === app.application_id ? { ...a, status: prev } : a)))
    setError((e as Error).message)
  }
}
```
- Drag: `onDragStart` → `e.dataTransfer.setData("text/plain", String(application_id))`; column `onDragOver` → `e.preventDefault()`; `onDrop` → find app by id, `move(app, columnStatus)`.
- Empty column text: "ไม่มีผู้สมัคร".

- [ ] Implement.
- [ ] Verify: `npx eslint "app/hr/jobs/[id]/page.tsx"` → 0 errors; `npx tsc --noEmit 2>&1 | grep "jobs/\[id\]"` → nothing.
- [ ] Verify PATCH shape: create an application then move it: `curl -s -X POST localhost:8080/applications -H "Content-Type: application/json" -d '{"user_id":2,"job_id":1,"status":"pending","note":""}'` then `curl -s -X PATCH localhost:8080/applications/<id> -H "Content-Type: application/json" -d '{"status":"screening","note":""}'` → success message.

---

### Task 5: HR applicant detail (`/hr/applications/[id]`)

**Files:**
- Create: `frontend/my-app/app/hr/applications/[id]/page.tsx`

**Interfaces:**
- Consumes: `api`, `useUser` (`@/lib/api`); `Application`, `User`, `Job`, `Screening`, `Interview`, `WorkTest`, `AppStatus`, `Result`, `InterviewStatus`, `RESULT_LABEL`, `INTERVIEW_STATUS_LABEL` (`@/lib/types`); `Loading`, `ErrorText`, `StatusBar`, `inputClass` (`@/components/app-ui`); `Button`.

Behaviour:
- `const { id } = useParams<{ id: string }>()`; `const me = useUser()` (guaranteed by `RoleGate`; guard `if (!me) return`).
- Load in one effect:
```tsx
api<Application>(`/applications/${id}`)
  .then((app) => Promise.all([
    app,
    api<User>(`/users/${app.user_id}`),
    api<Job>(`/jobs/${app.job_id}`),
    api<Screening[] | null>("/screenings"),
    api<Interview[] | null>("/interviews"),
    api<WorkTest[] | null>("/work-tests"),
  ]))
  .then(([app, user, job, s, i, w]) => setData({
    app, user, job,
    screenings: (s ?? []).filter((x) => x.application_id === app.application_id),
    interviews: (i ?? []).filter((x) => x.application_id === app.application_id),
    workTests: (w ?? []).filter((x) => x.application_id === app.application_id),
  }))
  .catch((e: Error) => setError(e.message))
```
- Top: `Link` "← {job.title}" to `/hr/jobs/${job.job_id}`; h1 applicant `full_name`; `StatusBar value={app.status} onChange={(s) => save({ status: s, note: app.note })}`.
- Info card: อีเมล, เบอร์โทร, ตำแหน่ง, วันที่สมัคร; note textarea (บันทึกภายใน) + "บันทึก" → PATCH `/applications/${id}` `{ status: app.status, note }`.
- Three section cards, each: list of existing rows + add form. Each row is its own small component in the same file with local edit state (`useState(initial)`, keyed by id) and a "บันทึก" button.
  - **คัดกรอง** (screenings): row = result select (`RESULT_LABEL`), note input, date (`screening_date`). Save → PATCH `/screenings/${screening_id}` `{ result, note }`. Add → POST `/screenings` `{ application_id, screened_by: me.user_id, result, note }`.
  - **สัมภาษณ์** (interviews): row = `<input type="date">` (`interview_date`), `<input type="time">` (`interview_time`), status select (`INTERVIEW_STATUS_LABEL`), result text input, note. Save → PATCH `/interviews/${interview_id}` `{ interview_date, interview_time, status, result, note }`. Add form: date (required), time (required), note → POST `/interviews` `{ application_id, interviewer_id: me.user_id, interview_date, interview_time, status: "scheduled", result: "", note }`.
  - **แบบทดสอบงาน** (work tests): row = date display, result select (`RESULT_LABEL`), note. Save → PATCH `/work-tests/${test_id}` `{ test_result, test_note }`. Add form: date (required), note → POST `/work-tests` `{ application_id, assigned_by: me.user_id, test_date: new Date(date).toISOString(), test_result: "pending", test_note: note }`.
  - Every save/add → `reload()`; errors → page `ErrorText`.
- Empty section text: "ยังไม่มีข้อมูล".

- [ ] Implement.
- [ ] Verify: `npx eslint "app/hr/applications/[id]/page.tsx"` → 0 errors; `npx tsc --noEmit 2>&1 | grep "applications/\[id\]"` → nothing.
- [ ] Verify payloads with curl against an existing application id (create one as in Task 4 if needed): POST `/screenings`, `/interviews` (`"interview_date":"2026-10-10","interview_time":"14:00"`), `/work-tests` (`"test_date":"2026-10-10T00:00:00.000Z"`) all return 201; GET `/interviews` shows `interview_time` like `14:00:00`.

---

### Task 6: Applicant pages (`/jobs`, `/my-applications`)

**Files:**
- Create: `frontend/my-app/app/(applicant)/jobs/page.tsx`, `frontend/my-app/app/(applicant)/my-applications/page.tsx`

**Interfaces:**
- Consumes: `api`, `useUser` (`@/lib/api`); `Job`, `Application`, `Interview`, `INTERVIEW_STATUS_LABEL` (`@/lib/types`); `Loading`, `ErrorText`, `StatusBar`, `inputClass` (`@/components/app-ui`); `Button`.

**`/jobs`**:
- Search form (input + "ค้นหา" button); committed query state `q` changes only on submit.
- Load (deps `[me?.user_id, q, tick]`): `Promise.all([api<Job[] | null>(`/jobs?search=${encodeURIComponent(q)}`), api<Application[] | null>(`/applications?user_id=${me.user_id}`)])` → show only `status === "open"` jobs; `applied = new Set(apps.map(a => a.job_id))`.
  - Note: `?search=` with empty string is fine (backend treats `""` as no search).
- Cards: title, location, description, requirement (`whitespace-pre-line`), button "สมัคร" → POST `/applications` `{ user_id: me.user_id, job_id, status: "pending", note: "" }` → `reload()`. Applied jobs show disabled "สมัครแล้ว". Disable the button while its request is in flight (track `busyJobId`).
- Empty state: "ไม่พบงานที่เปิดรับ".

**`/my-applications`**:
- Load: `Promise.all([api<Application[] | null>(`/applications?user_id=${me.user_id}`), api<Job[] | null>("/jobs"), api<Interview[] | null>("/interviews")])`.
- One card per application: job title (fallback `ตำแหน่ง #${job_id}`), location, apply date, read-only `<StatusBar value={app.status} />`, and for each interview of this application with `status === "scheduled"`: "นัดสัมภาษณ์ {date} เวลา {time.slice(0,5)}". Do **not** show `note` (internal HR note).
- Empty state: "ยังไม่ได้สมัครงาน" + `Link` to `/jobs`.

- [ ] Implement both.
- [ ] Verify: `npx eslint "app/(applicant)"` → 0 errors; `npx tsc --noEmit 2>&1 | grep "(applicant)"` → nothing.
- [ ] Verify: `curl -s "localhost:8080/jobs?search="` returns all jobs; `curl -s "localhost:8080/applications?user_id=2"` returns array or `null`.

---

### Task 7: Integration check (controller)

- [ ] `npm test`, `npm run lint`, `npm run build` in `frontend/my-app` — all pass.
- [ ] `curl -s -o /dev/null -w "%{http_code}" localhost:3000/ /register /hr/jobs /jobs /my-applications` → 200 each (dev server already running on 3000).
- [ ] Whole-branch review against spec + Review Focus.
