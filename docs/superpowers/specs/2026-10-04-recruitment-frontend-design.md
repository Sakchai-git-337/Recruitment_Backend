# Recruitment Frontend (แนว Odoo Recruitment) — Design

วันที่: 2026-10-04
ขอบเขต: `frontend/my-app` เท่านั้น — **ห้ามแก้ backend**

## เป้าหมาย

ระบบรับสมัครงานหน้าตา/flow แนว Odoo Recruitment ใช้ได้ 2 ฝั่ง:
- **HR** (`role = "recruitment"`): จัดการตำแหน่งงาน, ดูผู้สมัครเป็น Kanban ตามสถานะ, คัดกรอง/นัดสัมภาษณ์/work test
- **ผู้สมัคร** (`role = "applicant"`): สมัครสมาชิก, ดูงานที่เปิด, สมัคร, ติดตามสถานะ

สำเร็จเมื่อ: ทั้งสองฝั่งทำ flow ครบตั้งแต่ login → สมัคร → HR ย้ายสถานะจนถึง passed/rejected ได้ผ่าน backend จริง, `npm run lint` และ `npm run build` ผ่าน

## ข้อจำกัดจาก backend (ไม่แก้)

- `POST /login` — frontend เรียก route นี้ (`{email, password}` → User ไม่มี password) ตาม `loginUser` ที่มีอยู่ ฝั่ง backend ต้องเพิ่ม `r.POST("/login", loginUser)` เอง จนกว่าจะเพิ่ม login จะได้ 404
- ไม่มี auth/token — การกัน role ทำที่ frontend เท่านั้น (เป็นแค่ UX ไม่ใช่ security)
- list endpoint คืน `null` เมื่อว่าง → frontend ใช้ `?? []`
- `/screenings`, `/interviews`, `/work-tests` กรองไม่ได้ → ดึงทั้งหมดแล้วกรอง `application_id` ฝั่ง client
- `/applications` ไม่มีชื่อผู้สมัคร → join กับ `/users` ฝั่ง client
- `PATCH /jobs` เขียนทับทุก field → ส่ง job ครบทุกครั้ง
- `PATCH /applications` ต้องมี `status` + ส่ง `note` เดิมไปด้วย
- `PATCH /interviews` ต้องมี `interview_date`, `interview_time`, `status`
- `PATCH /screenings` ต้องมี `result`; `PATCH /work-tests` ต้องมี `test_result`
- `POST /work-tests` `test_date` เป็น `time.Time` → ส่ง ISO string
- backend ไม่กันสมัครซ้ำ → frontend เช็คก่อน
- CORS อนุญาตเฉพาะ `http://localhost:3000`

## ค่าสถานะ

| Entity | ค่า |
|---|---|
| Application | `pending` รอพิจารณา, `screening` คัดกรอง, `interview` สัมภาษณ์, `passed` ผ่าน, `rejected` ไม่ผ่าน |
| Job | `open` เปิดรับ, `closed` ปิดรับ |
| Screening / Work test result | `pending` รอผล, `pass` ผ่าน, `fail` ไม่ผ่าน |
| Interview | `scheduled` นัดแล้ว, `completed` เสร็จแล้ว, `cancelled` ยกเลิก |

## สถาปัตยกรรม

Client Components เรียก backend ตรงจาก browser, ไม่เพิ่ม dependency ใหม่ ลาก Kanban ด้วย HTML5 drag & drop

### ไฟล์ใหม่ใช้ร่วม
- `lib/api.ts`
  - `api<T>(path, {method?, body?})`: fetch `NEXT_PUBLIC_API_URL ?? "http://localhost:8080"`, JSON in/out, `!res.ok` → `throw new Error(data.error ?? "เกิดข้อผิดพลาด")`
  - `getUser()`, `setUser(user)`, `logout()`: localStorage key `user`, try/catch ทุกครั้ง
- `lib/types.ts`: type `User`, `Job`, `Application`, `Screening`, `Interview`, `WorkTest` ตาม struct Go + ค่าคงที่สถานะพร้อมป้ายไทย + `countByStatus(apps)` (ใช้ในการ์ดงาน/Kanban)

### หน้า
| Route | ใคร | เรียก API |
|---|---|---|
| `/` | ทุกคน | login (`components/ui/clean-minimal-sign-in.tsx` เดิม) → `POST /login` → `setUser` → redirect `/hr/jobs` หรือ `/jobs` ตาม role; ลิงก์ไป `/register` |
| `/register` | ทุกคน | `POST /users` (`role: "applicant"`, ทุกช่องบังคับ) → กลับ `/` |
| `/hr/jobs` | HR | `GET /jobs`, `GET /applications` → การ์ดงาน + จำนวนตามสถานะ; สร้าง/แก้ (`POST`/`PATCH /jobs`, `created_by` = user ปัจจุบัน) |
| `/hr/jobs/[id]` | HR | `GET /jobs/:id`, `GET /applications?job_id=`, `GET /users` → Kanban 5 คอลัมน์; ลาก → `PATCH /applications/:id` (optimistic, error → revert) |
| `/hr/applications/[id]` | HR | `GET /applications/:id`, `/users/:id`, `/jobs/:id`, `/screenings`, `/interviews`, `/work-tests` → statusbar คลิกเปลี่ยนสถานะ, note, เพิ่ม/แก้ screening/interview/work test |
| `/jobs` | ผู้สมัคร | `GET /jobs?search=` (แสดงเฉพาะ `open`), `GET /applications?user_id=` → ปุ่ม "สมัคร" / "สมัครแล้ว"; สมัคร = `POST /applications` `status: "pending"` |
| `/my-applications` | ผู้สมัคร | `GET /applications?user_id=`, `GET /jobs`, `GET /interviews` → รายการพร้อม statusbar + นัดสัมภาษณ์ |

### Layout
- `app/hr/layout.tsx` และ `app/(applicant)/layout.tsx`: top bar (ชื่อระบบ, เมนู, ชื่อผู้ใช้, ออกจากระบบ) + guard: ไม่มี user หรือ role ไม่ตรง → `router.replace("/")`
- `app/layout.tsx`: `lang="th"`, เปลี่ยน metadata title

### ลบ
- `components/demo.tsx`

## Error / Loading
- โหลด: "กำลังโหลด..."
- error: แถบแดงแสดง `error.message` (ข้อความจาก backend)
- Kanban drag ล้มเหลว → คืนสถานะเดิม + แสดง error

## UI
- ภาษาไทย, Tailwind v4 ที่มีอยู่ ใช้ `Button` (`components/ui/button.tsx`) และ lucide icons
- เลย์เอาต์แนว Odoo (การ์ดงาน, Kanban, statusbar แบบ chevron) แต่ไม่ใช้โลโก้/สีแบรนด์ Odoo
- ใช้งานได้ที่ความกว้างมือถือ (Kanban เลื่อนแนวนอนภายในกรอบของตัวเอง)

## การตรวจสอบ
- `npm run lint`, `npm run build` ผ่าน
- `node --test lib/types.test.ts` — เทสต์ `countByStatus`
- คลิกทดสอบจริงต้องรัน backend + Postgres (ผู้ใช้รันเอง; เครื่องนี้ไม่มี `go`)

## นอกขอบเขต
- แก้ backend, auth จริง/token, อัปโหลด CV, ปฏิทิน, อีเมลแจ้งเตือน, ลบ application/screening/interview/work test (backend ไม่มี route)
