import { test } from "node:test"
import assert from "node:assert/strict"
import {
  SECTIONS, emptyForm, validateStep, validateAll, firstInvalidStep, isValidNationalId, computeAge, optionLabel, fieldByKey,
  type ApplicationForm,
} from "./application-form.ts"

function validForm(): ApplicationForm {
  const f = emptyForm()
  Object.assign(f, {
    expected_salary: 30000, available_start_date: "2026-11-01",
    title_th: "นาย", first_name_th: "สมชาย", last_name_th: "ใจดี", date_of_birth: "1995-05-20",
    present_address: "1 ถ.สุขุมวิท", present_province: "กรุงเทพ", mobile_phone: "0812345678", email: "a@b.co",
    relevant_skills: "Go", has_work_experience: false, years_of_experience: 0,
    pdpa_consent: true, signature_name: "สมชาย ใจดี",
  })
  f.education = [{ level: "bachelor", institute: "มธ.", province: "", year_from: null, year_to: 2560, degree: "วท.บ.", major: "CS", gpa: 3.2 }]
  return f
}

test("emptyForm: fresh copies, defaults per spec", () => {
  const a = emptyForm(), b = emptyForm()
  assert.notEqual(a.education, b.education)
  assert.equal((a.education as unknown[]).length, 1)
  assert.deepEqual((a.languages as { language: string }[]).map((r) => r.language), ["ภาษาอังกฤษ"])
  assert.deepEqual((a.computer_skills as { name: string }[]).map((r) => r.name), ["Microsoft Office", "ERP"])
  assert.equal(a.credit_bureau_normal, true)
  assert.equal(a.has_work_experience, null)
})

test("8 sections in spec order", () => {
  assert.deepEqual(SECTIONS.map((s) => s.id), ["position", "personal", "contact", "family", "education", "skills", "experience", "questions"])
})

test("valid form has no errors; empty form flags required per step", () => {
  assert.deepEqual(validateAll(validForm()), {})
  assert.equal(firstInvalidStep(validForm()), null)
  const e = emptyForm()
  assert.deepEqual(Object.keys(validateStep(1, e)).sort(), ["available_start_date", "expected_salary"])
  assert.deepEqual(Object.keys(validateStep(2, e)).sort(), ["date_of_birth", "first_name_th", "last_name_th", "title_th"])
  assert.deepEqual(Object.keys(validateStep(3, e)).sort(), ["email", "mobile_phone", "present_address", "present_province"])
  assert.deepEqual(Object.keys(validateStep(4, e)), [])
  assert.ok(validateStep(5, e)["education.0.institute"])
  assert.deepEqual(Object.keys(validateStep(6, e)), ["relevant_skills"])
  assert.deepEqual(Object.keys(validateStep(7, e)).sort(), ["has_work_experience", "years_of_experience"])
  assert.deepEqual(Object.keys(validateStep(8, e)).sort(), ["pdpa_consent", "signature_name"])
  assert.equal(firstInvalidStep(e), 1)
})

test("education needs at least one row", () => {
  const f = validForm()
  f.education = []
  assert.ok(validateStep(5, f).education)
  assert.equal(firstInvalidStep(f), 5)
})

test("education row: gpa range and enum", () => {
  const f = validForm()
  ;(f.education as Record<string, unknown>[])[0].gpa = 4.5
  assert.ok(validateStep(5, f)["education.0.gpa"])
  ;(f.education as Record<string, unknown>[])[0].gpa = 3
  ;(f.education as Record<string, unknown>[])[0].level = "phd"
  assert.ok(validateStep(5, f)["education.0.level"])
})

test("expected salary must be > 0", () => {
  const f = validForm()
  f.expected_salary = 0
  assert.ok(validateStep(1, f).expected_salary)
  f.expected_salary = -5
  assert.ok(validateStep(1, f).expected_salary)
})

test("dates must be real calendar dates", () => {
  const f = validForm()
  f.date_of_birth = "1995-02-30"
  assert.ok(validateStep(2, f).date_of_birth)
  f.date_of_birth = "20/05/1995"
  assert.ok(validateStep(2, f).date_of_birth)
})

test("national id: optional, 13 digits, checksum", () => {
  assert.equal(isValidNationalId("1101700230678"), true)
  assert.equal(isValidNationalId("1101700230674"), false)
  assert.equal(isValidNationalId("123"), false)
  const f = validForm()
  assert.deepEqual(validateStep(2, f), {})
  f.national_id = "1101700230674"
  assert.ok(validateStep(2, f).national_id)
  f.national_id = "1101700230678"
  assert.deepEqual(validateStep(2, f), {})
})

test("mobile phone 9-10 digits; email format", () => {
  const f = validForm()
  for (const bad of ["12345678", "08123456789", "08x1234567"]) {
    f.mobile_phone = bad
    assert.ok(validateStep(3, f).mobile_phone, bad)
  }
  for (const ok of ["021234567", "0812345678", "081-234-5678"]) {
    f.mobile_phone = ok
    assert.equal(validateStep(3, f).mobile_phone, undefined, ok)
  }
  f.email = "nope"
  assert.ok(validateStep(3, f).email)
})

test("showIf: hidden fields are not validated, shown ones are", () => {
  const f = validForm()
  f.work_upcountry = "region"
  assert.equal(validateStep(1, f).work_upcountry_region, undefined) // optional even when shown
  f.work_upcountry = "no"
  f.work_upcountry_region = "x"
  assert.deepEqual(validateStep(1, f), {})
  f.has_work_experience = true
  assert.deepEqual(validateStep(7, f), {})
  ;(f.current_job as Record<string, unknown>).salary_current = "abc"
  assert.ok(validateStep(7, f)["current_job.salary_current"])
  f.has_work_experience = false
  assert.deepEqual(validateStep(7, f), {}) // current_job hidden
  assert.equal(fieldByKey("spouse_name")?.showIf?.({ marital_status: "married" }), true)
  assert.equal(fieldByKey("spouse_name")?.showIf?.({ marital_status: "single" }), false)
})

test("years of experience must be >= 0", () => {
  const f = validForm()
  f.years_of_experience = -1
  assert.ok(validateStep(7, f).years_of_experience)
})

test("signature must equal first + last name, whitespace-insensitive", () => {
  const f = validForm()
  f.signature_name = "สมชายใจดี"
  assert.equal(validateStep(8, f).signature_name, undefined)
  f.signature_name = "  สมชาย   ใจดี "
  assert.equal(validateStep(8, f).signature_name, undefined)
  f.signature_name = "สมหญิง ใจดี"
  assert.ok(validateStep(8, f).signature_name)
})

test("pdpa consent must be exactly true", () => {
  const f = validForm()
  f.pdpa_consent = false
  assert.ok(validateStep(8, f).pdpa_consent)
  f.pdpa_consent = true
  assert.equal(validateStep(8, f).pdpa_consent, undefined)
})

test("helpers: age, option label", () => {
  assert.equal(computeAge("2000-06-15", new Date("2026-06-14T12:00")), 25)
  assert.equal(computeAge("2000-06-15", new Date("2026-06-15T12:00")), 26)
  assert.equal(computeAge(""), null)
  assert.equal(optionLabel(fieldByKey("marital_status")!, "married"), "สมรส")
  assert.equal(optionLabel(fieldByKey("title_th")!, "นาย"), "นาย")
})
