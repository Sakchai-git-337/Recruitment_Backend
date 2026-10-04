# Backend Hardening + Route Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `backend/main.go` into route/resource files, add DB-session auth + role checks, fix every listed backend gap, and update the frontend to the new contract.

**Architecture:** One Go `package main`, flat files. Gin router built by `setupRouter()`. Auth = random token in `sessions` table, `authRequired()` + `requireRole()` middleware. Handlers keep using the global `db *pgxpool.Pool`. Integration tests with `httptest` against DB `recruitment_test`.

**Tech Stack:** Go 1.27 (only inside podman `golang:1.27`), Gin, pgx v5, `golang.org/x/crypto/bcrypt`; Next.js 16 frontend.

**Spec:** `docs/superpowers/specs/2026-10-04-backend-hardening-design.md` (binding — the permission table and contract there are exact).

## Global Constraints

- Branch `feat/backend-hardening`. Do not push. Commit messages end with a blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No new Go module except `golang.org/x/crypto` (already in go.mod). No new npm deps.
- User-facing error strings in Thai (`{"error": "..."}`), except the fixed `"unauthorized"` / `"forbidden"`.
- Never print or log passwords or `.env` values. Never run tests against `Project_Test`.
- Go is not installed on the host. Run Go via podman **from PowerShell** (Git Bash mangles `/app`):

```powershell
$B = "C:\Users\sutth\Documents\GitHub\Recruitment_Backend\backend"
# format + vet + build
podman run --rm --pod recruitment -v "${B}:/app" -v recruitment-gomod:/go/pkg/mod -v recruitment-gobuild:/root/.cache/go-build -w /app docker.io/library/golang:1.27 sh -c "gofmt -l . ; go vet ./... && go build -o /tmp/app . && echo BUILD_OK"
# tests (DB recruitment_test already exists)
podman run --rm --pod recruitment -e DB_NAME=recruitment_test -v "${B}:/app" -v recruitment-gomod:/go/pkg/mod -v recruitment-gobuild:/root/.cache/go-build -w /app docker.io/library/golang:1.27 go test ./... -count=1
# reload the running dev backend (it runs `go run .` on a read-only mount of backend/)
podman restart recruitment-backend
```
  `gofmt -l .` must print nothing. After `podman restart`, poll `curl -s localhost:8080/` until it answers (first compile ~20s).
- The running backend at `localhost:8080` uses DB `Project_Test` (seed: user 1 `hr@example.com` role recruitment, user 2 `applicant@example.com` role applicant, both password `1234` stored plaintext). Curl smoke tests may create rows there; send Thai text only from files (`--data-binary @file.json`), never inline in Git Bash.
- Frontend: `frontend/my-app`, dev server already on :3000 — never run `npm run build` or touch the dev server.

## Review Focus

1. Applicant token reading another applicant's application/interview (list or by id) → must be filtered out / 404, never leaked. (Tasks 4, 5)
2. Applicant sending `role`, `user_id`, `status`, `created_by` etc. in a body to escalate → ignored or 403. (Tasks 3, 4)
3. Existing plaintext passwords (seed `1234`) → still log in once, then stored as bcrypt. (Task 3)
4. Authenticated browser calls → CORS preflight must allow `Authorization`, otherwise the UI shows "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้". (Task 2)
5. PATCH with only one field → every other column unchanged (esp. password, note, created_by). (Tasks 3, 4, 5)

---

### Task 1: Pure split (no behavior change)

**Files:** Modify `backend/main.go`; Create `backend/routes.go`, `backend/db.go`, `backend/users.go`, `backend/jobs.go`, `backend/applications.go`, `backend/screenings.go`, `backend/interviews.go`, `backend/worktests.go`.

**Produces:** `func setupRouter() *gin.Engine` (routes.go: gin.Default + CORS + every route exactly as today); `func initDB()` (db.go, unchanged body); global `var db *pgxpool.Pool` (db.go). Each resource file holds its struct + its handlers, moved verbatim. `loginUser` moves to `users.go` (still unrouted — Task 3 routes it). `main.go` = `initDB(); defer db.Close(); r := setupRouter(); port...; r.Run(":"+port)`.

- [ ] Before editing: with the backend running, save `curl -s localhost:8080<path>` for `/`, `/users`, `/jobs`, `/applications`, `/screenings`, `/interviews`, `/work-tests` into a scratch dir outside the repo.
- [ ] Move code verbatim (no renames, no logic edits; gofmt allowed).
- [ ] format+vet+build → `BUILD_OK`, `gofmt -l` empty.
- [ ] `podman restart recruitment-backend`, wait, re-curl the same paths, `diff` against the saved outputs → identical.
- [ ] Commit `refactor(backend): split main.go into route and resource files`.

### Task 2: Foundation (errors, `[]`, schema, CORS, .env, tidy, test harness)

**Files:** Create `backend/httperr.go`, `backend/schema.sql`, `backend/helpers_test.go`, `backend/foundation_test.go`, `backend/.env.example`, `.gitignore` (repo root); Modify `backend/db.go`, `backend/routes.go`, every resource file, `backend/go.mod`, `backend/go.sum`; untrack `backend/.env` (`git rm --cached backend/.env` — file stays on disk).

**Produces (httperr.go):**
```go
func respondError(c *gin.Context, status int, msg string)      // c.JSON(status, gin.H{"error": msg})
func respondDBError(c *gin.Context, err error)                 // pgx.ErrNoRows→404 "ไม่พบข้อมูล"; *pgconn.PgError 23505→409 "ข้อมูลซ้ำ"; 23503,23514,22P02,22007,22008→400 "ข้อมูลไม่ถูกต้อง"; else log.Println(err) + 500 "เกิดข้อผิดพลาดภายในระบบ"
func isUniqueViolation(err error) bool                         // *pgconn.PgError with Code "23505"
func parseID(c *gin.Context) (int, bool)                       // strconv.Atoi(c.Param("id")); bad → respondError(400,"id ไม่ถูกต้อง"), false
```
**Produces (db.go):** `//go:embed schema.sql` + `func applySchema(ctx context.Context) error` (Exec whole file), called by `initDB` after Ping; error → `log.Fatal("apply schema: ", err)`.
**Produces (routes.go):** `func corsOrigins() []string` — split `CORS_ORIGINS` on `,`, trim, default `[]string{"http://localhost:3000"}`; CORS `AllowHeaders` = `Origin, Content-Type, Accept, Authorization`.
**Produces (helpers_test.go):**
```go
func TestMain(m *testing.M)  // gin.SetMode(gin.TestMode); godotenv.Load(); if DB_NAME lacks suffix "_test" → print "skip: DB_NAME must end with _test" and os.Exit(0); initDB(); code := m.Run(); db.Close(); os.Exit(code)
func newTestRouter(t *testing.T) *gin.Engine  // TRUNCATE users, jobs, applications, screenings, interviews, work_tests, sessions RESTART IDENTITY CASCADE; return setupRouter()
func doJSON(t *testing.T, r http.Handler, method, path, token string, body any) *httptest.ResponseRecorder  // JSON-encode body if non-nil; set Authorization: Bearer token if token != ""
```

`schema.sql`: same tables/columns/constraints as the running DB (copy from the "Current schema" block below), all `CREATE TABLE IF NOT EXISTS`, plus:
```sql
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days'
);
CREATE UNIQUE INDEX IF NOT EXISTS applications_user_job_uniq ON applications(user_id, job_id);
```
Current schema (get it with `podman exec recruitment-postgres pg_dump -U postgres -s -d Project_Test`; tables users, jobs, applications, screenings, interviews, work_tests with SERIAL ids, NOT NULL text columns, `note/result/test_result/test_note TEXT NOT NULL DEFAULT ''`, timestamps `DEFAULT now()`, FKs `ON DELETE CASCADE`, CHECKs on users.role and jobs.status). No seed rows in schema.sql.

Other edits:
- Every handler: not-found/DB errors via `respondDBError`; every `:id` via `parseID`; every list initialised `x := []T{}`; `if err := rows.Err(); err != nil { respondDBError(c, err); return }` after loops. Keep existing request validation messages but make them Thai.
- `.gitignore` (root): `backend/.env`. `.env.example`: keys `DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSLMODE, PORT, CORS_ORIGINS` with placeholder values (no real password).
- `go mod tidy` (needs a read-write mount — the commands above are rw): direct deps no longer `// indirect`.

Tests (`foundation_test.go`, TDD — write first, see fail, implement):
- `TestEmptyListsReturnArray`: on empty DB, GET `/users`, `/jobs`, `/applications`, `/screenings`, `/interviews`, `/work-tests` → 200 body exactly `[]`.
- `TestNotFoundAndBadID`: GET `/jobs/999` → 404; GET `/jobs/abc` → 400.
- `TestDuplicateEmailConflict`: POST `/users` same email twice → second 409.
- `TestCORSAllowsAuthorization`: OPTIONS `/jobs` with `Origin: http://localhost:3000`, `Access-Control-Request-Method: PATCH`, `Access-Control-Request-Headers: Authorization` → `Access-Control-Allow-Headers` contains `Authorization` (case-insensitive).
- `TestInternalErrorHidden`: unit-test `respondDBError` with `errors.New("secret detail")` on a `httptest` gin context → 500 and body does not contain `secret detail`.

- [ ] Tests fail first; implement; tests pass; format+vet+build clean; restart backend + curl `/jobs` OK; `git status` shows `backend/.env` deleted from index but present on disk.
- [ ] Commit `feat(backend): error mapping, empty lists, schema, cors env, test harness`.

(Task 3 will change these tests to send tokens once routes require auth.)

### Task 3: Auth + users

**Files:** Create `backend/auth.go`, `backend/auth_test.go`; Modify `backend/users.go`, `backend/routes.go`, `backend/helpers_test.go`, `backend/foundation_test.go`.

**Produces (auth.go):**
```go
func hashPassword(plain string) (string, error)                  // bcrypt.DefaultCost
func checkPassword(stored, plain string) (ok, needsRehash bool)  // stored starts "$2" → bcrypt compare; else plaintext equal → (true,true)
func newToken() (string, error)                                   // 32 bytes crypto/rand, hex
func loginUser(c *gin.Context)    // POST /login → 200 {"token","user"}; bad creds 401 "อีเมลหรือรหัสผ่านไม่ถูกต้อง"; rehash when needsRehash; INSERT sessions
func logoutUser(c *gin.Context)   // DELETE FROM sessions WHERE token = current → 200 {"message":"ออกจากระบบแล้ว"}
func authRequired() gin.HandlerFunc        // Bearer token → SELECT u.* FROM sessions s JOIN users u ... WHERE s.token=$1 AND s.expires_at > now(); missing/invalid → 401 {"error":"unauthorized"}; sets c.Set("user", User) and c.Set("token", tok)
func requireRole(role string) gin.HandlerFunc  // currentUser(c).Role != role → 403 {"error":"forbidden"}
func currentUser(c *gin.Context) User
func isHR(c *gin.Context) bool              // currentUser(c).Role == "recruitment"
```
Remove the old `loginUser` from users.go.

**users.go:**
- `createUser` (public): validate full_name, email, password, phone non-empty; **role always `applicant`** (ignore body); store `hashPassword`; duplicate email → 409 "อีเมลนี้ถูกใช้แล้ว"; response has no password.
- `getUsers` (HR route), `getUserByID`: applicant may read only own id, else 403.
- `updateUser`: partial — body struct with pointer fields `*string` for full_name, email, password, phone, role. Applicant: only own id (else 403); sending `role` → 403. HR: any user, role must be applicant/recruitment. Password provided → hash. Empty string for any provided field → 400. SQL with `COALESCE($n, column)`. Duplicate email → 409. Response without password.
- `deleteUser` HR only (route).

**routes.go** (exact grouping; Tasks 4/5 add handler-level scoping):
```go
r.GET("/", ...)
r.POST("/login", loginUser)
r.POST("/users", createUser)
r.GET("/jobs", getJobs); r.GET("/jobs/:id", getJobByID)
auth := r.Group("/", authRequired())
auth.POST("/logout", logoutUser)
auth.GET("/users/:id", getUserByID); auth.PATCH("/users/:id", updateUser)
auth.GET("/applications", getApplications); auth.GET("/applications/:id", getApplicationByID); auth.POST("/applications", createApplication)
auth.GET("/interviews", getInterviews); auth.GET("/interviews/:id", getInterviewByID)
hr := auth.Group("/", requireRole("recruitment"))
hr.GET("/users", getUsers); hr.DELETE("/users/:id", deleteUser)
hr.POST("/jobs", createJob); hr.PATCH("/jobs/:id", updateJob); hr.DELETE("/jobs/:id", deleteJob)
hr.PATCH("/applications/:id", updateApplication)
hr.POST("/screenings", createScreening); hr.GET("/screenings", getScreenings); hr.GET("/screenings/:id", getScreeningByID); hr.PATCH("/screenings/:id", updateScreening)
hr.POST("/interviews", createInterview); hr.PATCH("/interviews/:id", updateInterview)
hr.POST("/work-tests", createWorkTest); hr.GET("/work-tests", getWorkTests); hr.GET("/work-tests/:id", getWorkTestByID); hr.PATCH("/work-tests/:id", updateWorkTest)
```

**helpers_test.go adds:**
```go
func seedUser(t *testing.T, name, email, password, role string) User  // INSERT with hashPassword(password); returns User (no password)
func loginToken(t *testing.T, r http.Handler, email, password string) string  // POST /login, require 200, return token
```
Update `foundation_test.go` to send an HR token where routes now need auth (`/users` etc.); `/jobs` stays public.

Tests (`auth_test.go`):
- login OK → 200, token len 64, `user.role` correct, body has no `password` key.
- wrong password → 401; unknown email → 401.
- legacy plaintext: INSERT user with password `1234` raw → login OK → stored password now starts with `$2`.
- no token GET `/users` → 401; applicant token → 403; HR token → 200.
- logout → same token then 401.
- expired: `UPDATE sessions SET expires_at = now() - interval '1 minute'` → 401.
- register with `"role":"recruitment"` → 201 and role `applicant`.
- applicant PATCH own `{"role":"recruitment"}` → 403; PATCH other user → 403; GET other user → 403.
- applicant PATCH own `{"phone":"0999"}` → 200; full_name/email unchanged; can still log in with old password.
- HR PATCH user `{"password":"new"}` → old password 401, new 200.

- [ ] TDD; format+vet+build+tests clean; restart backend; curl `POST /login` with `hr@example.com`/`1234` (from a JSON file) → token; seed passwords in Project_Test now bcrypt.
- [ ] Commit `feat(backend): session auth, bcrypt, role checks, users rules`.

### Task 4: Jobs + applications

**Files:** Modify `backend/jobs.go`, `backend/applications.go`, `backend/routes.go`; Create `backend/applications_test.go`.

**jobs.go:** `createJob` — `created_by = currentUser(c).UserID` (ignore body); validate title/description/requirement/location non-empty, status open|closed. `updateJob` partial via pointer fields + COALESCE (status validated if given; `created_by` not updatable). `deleteJob` unchanged except errors.

**applications.go:**
- `Application` struct adds read-only `ApplicantName string json:"applicant_name"`, `ApplicantEmail json:"applicant_email"`, `ApplicantPhone json:"applicant_phone"`, `JobTitle json:"job_title"`; list and by-id queries `JOIN users u ON u.user_id = a.user_id JOIN jobs j ON j.job_id = a.job_id`.
- `getApplications`: filters status/job_id/user_id (bad int → 400). Applicant: `user_id` forced to self (query value ignored), `note` set to `""` on every row.
- `getApplicationByID`: applicant and not own → 404; applicant → `note` `""`.
- `createApplication`: applicant → `user_id` = self, `status` = `pending`, note `""` (body ignored except job_id). HR → `user_id` required, status validated (default `pending`). Job missing → 404 "ไม่พบตำแหน่งงาน"; job closed → 400 "ตำแหน่งนี้ปิดรับสมัครแล้ว"; unique violation → 409 "สมัครตำแหน่งนี้แล้ว".
- `updateApplication` partial: `status *string`, `note *string`; at least one → else 400; status validated.
- `deleteApplication` new (HR): 200 / 404. Route `hr.DELETE("/applications/:id", deleteApplication)`.

Tests (`applications_test.go`): HR create job with body `created_by: 999` → stored created_by = HR id; PATCH job `{"status":"closed"}` keeps title; applicant POST /jobs → 403; applicant apply with body `user_id` of someone else + `status:"passed"` → 201, own user_id, `pending`; apply twice → 409; apply to closed job → 400; applicant A GET `/applications?user_id=<B>` → only A's rows, notes `""`; applicant A GET B's application by id → 404; HR GET `/applications` rows have `applicant_name` and `job_title`; HR PATCH `{"status":"interview"}` keeps note; HR DELETE → 200 then GET 404.

- [ ] TDD; all backend tests pass; format/vet/build clean; restart backend + curl smoke.
- [ ] Commit `feat(backend): jobs and applications scoping, joins, partial updates`.

### Task 5: Screenings, interviews, work tests

**Files:** Modify `backend/screenings.go`, `backend/interviews.go`, `backend/worktests.go`, `backend/routes.go`; Create `backend/stages_test.go`.

- All three lists: optional `?application_id=` filter (bad int → 400); `[]` when empty.
- `screened_by` / `interviewer_id` / `assigned_by` = `currentUser(c).UserID` (ignore body).
- Partial PATCH with pointer fields + COALESCE: screenings `result, note` (result enum pass|fail|pending); interviews `interview_date, interview_time, status, result, note` (status enum scheduled|completed|cancelled; date/time cast `::date`/`::time`, bad → 400); work tests `test_date, test_result, test_note` (`test_date` RFC3339; result enum).
- `createWorkTest`: `application_id` and `test_date` required; `test_result` default `pending`, else enum.
- Interviews for applicants (routes from Task 3): list → only rows whose application belongs to self (`JOIN applications a ... WHERE a.user_id = $me`), `result` and `note` = `""`; by id not own → 404.
- New HR routes: `DELETE /screenings/:id`, `/interviews/:id`, `/work-tests/:id`.

Tests (`stages_test.go`): `?application_id=` returns only that application's rows (two applications seeded); created rows use HR id even if body sends another id; PATCH screening `{"note":"x"}` keeps result; PATCH interview `{"status":"completed"}` keeps date/time; work test without `test_date` → 400, `test_result:"maybe"` → 400, omitted → `pending`; applicant A GET `/interviews` sees only own with empty result/note; applicant GET other's interview → 404; applicant GET `/screenings` → 403; HR DELETE each → 200 then 404.

- [ ] TDD; all backend tests pass; format/vet/build clean; restart backend + curl smoke.
- [ ] Commit `feat(backend): stage filters, scoping, partial updates, deletes`.

### Task 6: Frontend contract update

**Files:** Modify `frontend/my-app/lib/api.ts`, `lib/types.ts`, `lib/lib.test.ts`, `components/app-ui.tsx`, `components/ui/clean-minimal-sign-in.tsx`, `app/register/page.tsx`, `app/hr/jobs/[id]/page.tsx`, `app/hr/applications/[id]/page.tsx`.

**Produces (`@/lib/api`):** `setSession(token: string, user: User): void` (replaces `setUser`), `logout()` clears `token` + `user`, `api()` adds `Authorization: Bearer <token>` when a token is stored (read via try/catch), and on `res.status === 401` calls `logout()` before throwing `ApiError`. `useUser()` unchanged.
**types.ts:** `Application` adds `applicant_name?: string; applicant_email?: string; applicant_phone?: string; job_title?: string`.

- sign-in: `const { token, user } = await api<{ token: string; user: User }>("/login", ...)`; `setSession(token, user)`; drop the 404 "backend ยังไม่มี POST /login" branch (keep 401 message).
- app-ui logout button: `api("/logout", { method: "POST" }).catch(() => {})` then `logout()` + `router.replace("/")`.
- register: body without `role`; 409 → "อีเมลนี้ถูกใช้แล้ว" (status-based, drop the `duplicate` text check).
- Kanban: drop the `/users` fetch; card shows `app.applicant_name ?? `ผู้สมัคร #${app.user_id}`` and `app.applicant_email`.
- Detail: load `api<Application>(/applications/${id})` then `Promise.all([/screenings?application_id=${id}, /interviews?application_id=${id}, /work-tests?application_id=${id}])` (each `?? []`, no client-side filtering); applicant info from `app.applicant_name/email/phone`, job from `app.job_title` + `app.job_id`; drop `/users/:id` and `/jobs/:id` fetches.
- Applicant pages unchanged (backend now scopes them).
- Tests (`lib.test.ts`) add: stored token → request has `Authorization: Bearer tok` (stub `globalThis.localStorage` with a Map-backed object); 401 response → stored token and user removed. Existing 7 tests keep passing.

- [ ] `npm test`, `npx eslint .`, `npx tsc --noEmit` clean (in `frontend/my-app`).
- [ ] Commit `feat(frontend): bearer auth and new backend contract`.

### Task 7: End-to-end check (controller)

- [ ] Restart backend; `npm run build`; curl script: register applicant → login → apply to job 1 → HR login → HR PATCH status interview + note → HR POST interview → applicant GET `/applications` (note `""`) and `/interviews` (own only) → applicant GET `/screenings` 403 → logout → token 401. Frontend routes 200 on :3000.
