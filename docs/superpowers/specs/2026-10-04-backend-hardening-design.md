# Backend Hardening + Route Split — Design

วันที่: 2026-10-04 · Branch: `feat/backend-hardening` (ต่อจาก `feat/recruitment-frontend`)
อนุมัติโดยผู้ใช้: design + ตารางสิทธิ์ + "แค่เอา .env ออกจาก git (ไม่ rewrite history)"

## เป้าหมาย
แก้ทุกข้อที่ขาดใน `backend/` (login route, auth, bcrypt, .env, schema, ข้อมูลรั่ว, PATCH ทับ, validation, error ดิบ, `[]`, rows.Err, go mod tidy, CORS env, tests, DELETE) + แยกไฟล์ + ปรับ frontend ให้ใช้ contract ใหม่

## โครงไฟล์ (`package main` เดียว)
`main.go` (start) · `routes.go` (`setupRouter() *gin.Engine` + สิทธิ์ต่อ route) · `db.go` (`initDB`, `applySchema`) · `schema.sql` (embed) · `httperr.go` · `auth.go` · `users.go` `jobs.go` `applications.go` `screenings.go` `interviews.go` `worktests.go` · `*_test.go` · `.env.example`
`.env` ออกจาก git (`git rm --cached`) + root `.gitignore` มี `backend/.env`

## Auth
- `POST /login {email,password}` → `200 {token, user}` (user ไม่มี password) · ผิด → `401 {"error":"อีเมลหรือรหัสผ่านไม่ถูกต้อง"}`
- token = 32 random bytes (`crypto/rand`) hex, ตาราง `sessions(token TEXT PK, user_id INT FK→users ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days')`
- header `Authorization: Bearer <token>`; ไม่มี/ผิด/หมดอายุ → `401 {"error":"unauthorized"}`; role ไม่พอ → `403 {"error":"forbidden"}`
- `POST /logout` (auth) ลบ session → `200`
- รหัสผ่าน bcrypt (`golang.org/x/crypto/bcrypt`); login เจอรหัสเก่าที่ไม่ใช่ bcrypt (ไม่ขึ้นต้น `$2`) → เทียบ plaintext, ถ้าตรง rehash แล้วบันทึก

## ตารางสิทธิ์
| Route | Public | Applicant | HR |
|---|---|---|---|
| `POST /login` | ✓ | | |
| `POST /users` | ✓ (role ถูกบังคับเป็น `applicant`) | | |
| `GET /jobs`, `GET /jobs/:id` | ✓ | ✓ | ✓ |
| `POST /logout` | | ✓ | ✓ |
| `GET /users` | | | ✓ |
| `GET/PATCH /users/:id` | | ตัวเองเท่านั้น; ส่ง `role` → 403 | ✓ |
| `DELETE /users/:id` | | | ✓ |
| `POST/PATCH/DELETE /jobs` | | | ✓ |
| `GET /applications`, `GET /applications/:id` | | ของตัวเองเท่านั้น (`user_id` ถูกบังคับ, อื่น → 404), `note` = `""` | ✓ |
| `POST /applications` | | `user_id` = ตัวเอง, `status` = `pending` | ✓ (`user_id` จาก body) |
| `PATCH/DELETE /applications/:id` | | | ✓ |
| `GET /interviews`, `GET /interviews/:id` | | เฉพาะของ application ตัวเอง, `result`/`note` = `""` | ✓ |
| อื่นๆ ของ screenings/interviews/work-tests | | | ✓ |

## Contract เปลี่ยน
- list ว่าง → `[]` เสมอ; เช็ค `rows.Err()`
- `Application` เพิ่ม read-only: `applicant_name`, `applicant_email`, `applicant_phone`, `job_title` (JOIN users/jobs) ทั้ง list และ by id
- filter: `GET /screenings|/interviews|/work-tests?application_id=N`
- PATCH ทุกตัว = partial (field ที่ไม่ส่ง = คงเดิม; ส่ง string ว่างใน field บังคับ → 400; enum ตรวจเฉพาะ field ที่ส่ง)
- `created_by`/`screened_by`/`interviewer_id`/`assigned_by` = user จาก token (ไม่อ่าน body)
- `POST /applications` งาน `closed` → 400; ซ้ำ `(user_id, job_id)` → 409 (unique index)
- `POST /work-tests`: `application_id`, `test_date` (RFC3339) บังคับ; `test_result` default `pending`, ต้องเป็น pending/pass/fail
- `POST /jobs`: ไม่ตรวจ `created_by` จาก body อีก
- DELETE ใหม่ (HR): `/applications/:id`, `/screenings/:id`, `/interviews/:id`, `/work-tests/:id`
- error: no rows → 404; pg `23505` → 409 (`"ข้อมูลซ้ำ"` หรือข้อความเฉพาะ เช่นอีเมล/สมัครซ้ำ); `23503`/`23514`/`22P02`/`22007`/`22008` → 400; อื่น → 500 `{"error":"เกิดข้อผิดพลาดภายในระบบ"}` + `log.Println` error จริง; id ที่ไม่ใช่ตัวเลข → 400
- CORS: `CORS_ORIGINS` (comma-separated, default `http://localhost:3000`), `AllowHeaders` มี `Authorization`, methods เดิม

## Schema
`backend/schema.sql` (idempotent: `CREATE TABLE IF NOT EXISTS` ทุกตาราง + `sessions` + `CREATE UNIQUE INDEX IF NOT EXISTS applications_user_job_uniq ON applications(user_id, job_id)`), embed แล้วรันตอนเริ่ม; ล้ม → `log.Fatal` พร้อมข้อความ. ไม่มี seed ใน schema.

## Frontend
- `lib/api.ts`: เก็บ `token` คู่ `user`; แนบ `Authorization: Bearer`; ตอบ 401 → `logout()` แล้ว throw (RoleGate พาไป `/`)
- login: รับ `{token,user}`; ปุ่มออกจากระบบเรียก `POST /logout` (ไม่รอผล) แล้ว `logout()`
- register: ไม่ส่ง `role`
- Kanban/detail/my-applications ใช้ field JOIN แทน `/users`/`/jobs`; detail ใช้ `?application_id=`
- ข้อความ 404 ของ login เดิม (backend ไม่มี /login) ลบได้

## Tests
- Go: `testing` + `httptest` กับ DB `recruitment_test` (ใน container เดียวกัน) — helper ปฏิเสธถ้า `DB_NAME` ไม่ลงท้าย `_test`; truncate ก่อนแต่ละเทสต์
- frontend: `node --test` เดิม + เคส Authorization header / 401

## นอกขอบเขต
rewrite git history, เปลี่ยนรหัส DB จริง (ผู้ใช้ทำเอง), rate limit, refresh token, UI สำหรับ DELETE
