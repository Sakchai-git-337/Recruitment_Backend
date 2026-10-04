import { test } from "node:test"
import assert from "node:assert/strict"
import { stepForError } from "./application-errors.ts"

test("maps messages to steps", () => {
  assert.deepEqual(stepForError("กรุณากรอก expected_salary"), { step: 1, field: "expected_salary" })
  assert.deepEqual(stepForError("กรุณากรอกอีเมล"), { step: 3, field: "email" })
  assert.deepEqual(stepForError("ไฟล์ต้องเป็น PDF, JPG หรือ PNG"), { step: 8, field: undefined })
  assert.deepEqual(stepForError("กรุณาแนบ Resume / CV"), { step: 8, field: "doc_resume" })
  assert.equal(stepForError("เกิดข้อผิดพลาด"), null)
})

test("server field key path wins over the message", () => {
  assert.deepEqual(stepForError("ข้อมูลไม่ถูกต้อง", "education.0.level"), { step: 5, field: "education.0.level" })
  assert.deepEqual(stepForError("ข้อมูลไม่ถูกต้อง", "doc_resume"), { step: 8, field: "doc_resume" })
  assert.deepEqual(stepForError("กรุณากรอกอีเมล", "unknown_key"), { step: 3, field: "email" })
})
