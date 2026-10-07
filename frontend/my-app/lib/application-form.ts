// Single source of truth for the online application form (spec section 6).
// The wizard renders from SECTIONS, FormViewer renders a submitted form from SECTIONS,
// the backend keeps its own Go list of the required (`required: true`) keys.

export type FieldType = "text" | "textarea" | "date" | "month" | "number" | "enum" | "bool" | "list" | "group"
export type Option = { value: string | number; label: string }
export type Row = Record<string, unknown>
/** number fields hold `number | null`, bool fields `boolean | null`, text/date/enum fields `string` ("" = empty) */
export type ApplicationForm = Record<string, unknown>
export type Errors = Record<string, string>

export type Field = {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: Option[]
  showIf?: (form: ApplicationForm) => boolean
  min?: number
  max?: number
  /** number must be > 0 */
  positive?: boolean
  /** extra rule */
  format?: "national_id" | "phone" | "email" | "signature" | "consent" | "postcode" | "thai" | "english" | "letters"
  /** text: "thai-address" = ตำบล combobox that also fills sibling `<prefix>district|province|postcode`; "thai-province" = province suggestions */
  widget?: "thai-address" | "thai-province"
  /** unit shown next to a number input (บาท, ซม., ...) */
  unit?: string
  /** bool: [label for true, label for false]; default ใช่/ไม่ใช่ */
  yesNo?: [string, string]
  /** list / group: the sub-fields */
  fields?: Field[]
  /** list: minimum rows (required lists) */
  minRows?: number
  /** list: rows a new form starts with */
  defaultRows?: () => Row[]
}

export type Section = { id: string; title: string; description?: string; fields: Field[] }

const opts = (pairs: [string | number, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }))
const RATING = opts([[1, "พอใช้"], [2, "ดี"], [3, "ดีมาก"]])
const text = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, label, type: "text", ...extra })
const area = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, label, type: "textarea", ...extra })
const num = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, label, type: "number", ...extra })
const date = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, label, type: "date", ...extra })
const month = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, label, type: "month", ...extra })
const bool = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, label, type: "bool", ...extra })
const choice = (key: string, label: string, options: Option[], extra: Partial<Field> = {}): Field => ({ key, label, type: "enum", options, ...extra })

const STATUS = opts([["alive", "ยังมีชีวิตอยู่"], ["deceased", "เสียชีวิตแล้ว"]])
const parent = (p: "father" | "mother", th: string): Field[] => [
  text(`${p}_name`, `ชื่อ-นามสกุล${th}`),
  choice(`${p}_status`, "สถานะ", STATUS),
  num(`${p}_age`, "อายุ", { min: 0, max: 150, unit: "ปี" }),
  text(`${p}_occupation`, "อาชีพ"),
  text(`${p}_phone`, "เบอร์โทรศัพท์"),
]
const married = (f: ApplicationForm) => f.marital_status === "married"
const when = (key: string, value: unknown) => (f: ApplicationForm) => f[key] === value

export const SECTIONS: Section[] = [
  {
    id: "position",
    title: "ตำแหน่งที่สมัคร",
    fields: [
      num("expected_salary", "เงินเดือนที่คาดหวัง", { required: true, positive: true, unit: "บาท" }),
      date("available_start_date", "วันที่เริ่มงานได้", { required: true }),
      choice("work_upcountry", "ทำงานต่างจังหวัดได้หรือไม่", opts([["no", "ไม่ได้"], ["sometimes", "บางครั้ง"], ["anywhere", "ได้ทั่วประเทศ"], ["region", "เฉพาะภาค"]])),
      text("work_upcountry_region", "ระบุภาค", { showIf: when("work_upcountry", "region") }),
      choice("current_status", "สถานะปัจจุบัน", opts([["unemployed", "ว่างงาน"], ["full_time", "มีงานประจำ"], ["part_time", "งานเสริม"]])),
      choice("job_source", "ทราบข่าวการรับสมัครจาก", opts([["website", "เว็บไซต์"], ["facebook", "Facebook"], ["line", "LINE"], ["job_board", "เว็บหางาน"], ["referral", "คนแนะนำ"], ["other", "อื่นๆ"]])),
      text("job_source_other", "ระบุแหล่งที่มา", { showIf: when("job_source", "other") }),
      text("referrer_name", "ชื่อผู้แนะนำ", { showIf: when("job_source", "referral") }),
      text("referrer_code", "รหัสผู้แนะนำ", { showIf: when("job_source", "referral") }),
    ],
  },
  {
    id: "personal",
    title: "ข้อมูลส่วนตัว",
    fields: [
      choice("title_th", "คำนำหน้า (ไทย)", opts([["นาย", "นาย"], ["นาง", "นาง"], ["นางสาว", "นางสาว"]]), { required: true }),
      text("first_name_th", "ชื่อ (ไทย)", { required: true, format: "thai" }),
      text("last_name_th", "นามสกุล (ไทย)", { required: true, format: "thai" }),
      text("nickname", "ชื่อเล่น"),
      choice("title_en", "คำนำหน้า (อังกฤษ)", opts([["Mr.", "Mr."], ["Mrs.", "Mrs."], ["Miss", "Miss"]]), { required: true }),
      text("first_name_en", "ชื่อ (อังกฤษ)", { required: true, format: "english" }),
      text("last_name_en", "นามสกุล (อังกฤษ)", { required: true, format: "english" }),
      choice("gender", "เพศ", opts([["male", "ชาย"], ["female", "หญิง"]])),
      date("date_of_birth", "วันเกิด", { required: true }),
      text("birth_province", "จังหวัดที่เกิด"),
      choice("blood_type", "กรุ๊ปเลือด", opts([["A", "A"], ["B", "B"], ["AB", "AB"], ["O", "O"]])),
      text("religion", "ศาสนา"),
      text("nationality", "สัญชาติ"),
      text("race", "เชื้อชาติ"),
      text("national_id", "เลขบัตรประชาชน", { format: "national_id" }),
      text("id_issued_at", "สถานที่ออกบัตร"),
      text("id_issue_province", "จังหวัดที่ออกบัตร"),
      date("id_issue_date", "วันที่ออกบัตร"),
      date("id_expiry_date", "วันที่บัตรหมดอายุ"),
      choice("military_status", "สถานะทางทหาร", opts([["completed", "ผ่านการเกณฑ์แล้ว"], ["exempted", "ได้รับการยกเว้น"], ["not_applicable", "ไม่เกี่ยวข้อง"]])),
      num("height_cm", "ส่วนสูง", { min: 0, max: 300, unit: "ซม." }),
      num("weight_kg", "น้ำหนัก", { min: 0, max: 500, unit: "กก." }),
    ],
  },
  {
    id: "contact",
    title: "ที่อยู่และการติดต่อ",
    fields: [
      area("present_address", "บ้านเลขที่ / หมู่ / ซอย / ถนน", { required: true }),
      text("present_subdistrict", "ตำบล/แขวง", { widget: "thai-address" }),
      text("present_district", "อำเภอ/เขต"),
      text("present_province", "จังหวัด", { required: true, widget: "thai-province" }),
      text("present_postcode", "รหัสไปรษณีย์", { format: "postcode" }),
      choice("residence_type", "ลักษณะที่อยู่อาศัย", opts([["own", "บ้านตนเอง"], ["parents", "บ้านบิดา-มารดา"], ["rental", "บ้านเช่า"], ["dormitory", "หอพัก"], ["other", "อื่นๆ"]])),
      text("mobile_phone", "เบอร์โทรศัพท์มือถือ", { required: true, format: "phone" }),
      text("home_phone", "เบอร์โทรศัพท์บ้าน"),
      text("email", "อีเมล", { required: true, format: "email" }),
      text("line_id", "LINE ID"),
      text("emergency_name", "ผู้ติดต่อฉุกเฉิน"),
      text("emergency_relationship", "ความสัมพันธ์"),
      text("emergency_phone", "เบอร์โทรศัพท์ผู้ติดต่อฉุกเฉิน"),
    ],
  },
  {
    id: "family",
    title: "ครอบครัว",
    fields: [
      ...parent("father", "บิดา"),
      ...parent("mother", "มารดา"),
      area("parents_address", "ที่อยู่บิดา-มารดา (บ้านเลขที่ / หมู่ / ซอย / ถนน)"),
      text("parents_subdistrict", "ตำบล/แขวง", { widget: "thai-address" }),
      text("parents_district", "อำเภอ/เขต"),
      text("parents_province", "จังหวัด", { widget: "thai-province" }),
      text("parents_postcode", "รหัสไปรษณีย์", { format: "postcode" }),
      choice("marital_status", "สถานภาพสมรส", opts([["single", "โสด"], ["married", "สมรส"], ["divorced", "หย่า"], ["widowed", "หม้าย"]])),
      text("spouse_name", "ชื่อ-นามสกุลคู่สมรส", { showIf: married }),
      choice("spouse_status", "สถานะคู่สมรส", STATUS, { showIf: married }),
      num("spouse_age", "อายุคู่สมรส", { min: 0, max: 150, unit: "ปี", showIf: married }),
      text("spouse_occupation", "อาชีพคู่สมรส", { showIf: married }),
      text("spouse_phone", "เบอร์โทรศัพท์คู่สมรส", { showIf: married }),
      num("children_count", "จำนวนบุตร", { min: 0, max: 50, unit: "คน" }),
      num("siblings_count", "จำนวนพี่น้อง", { min: 0, max: 50, unit: "คน" }),
    ],
  },
  {
    id: "education",
    title: "การศึกษา",
    fields: [
      {
        key: "education", label: "ประวัติการศึกษา", type: "list", required: true, minRows: 1,
        defaultRows: () => [{ level: "", institute: "", province: "", year_from: null, year_to: null, degree: "", major: "", gpa: null }],
        fields: [
          choice("level", "ระดับการศึกษา", opts([["primary", "ประถมศึกษา"], ["lower_secondary", "มัธยมศึกษาตอนต้น"], ["upper_secondary", "มัธยมศึกษาตอนปลาย"], ["vocational_cert", "ปวช."], ["diploma", "ปวส./อนุปริญญา"], ["bachelor", "ปริญญาตรี"], ["master_or_higher", "ปริญญาโทขึ้นไป"]]), { required: true }),
          text("institute", "สถาบัน", { required: true, format: "letters" }),
          text("province", "จังหวัด"),
          num("year_from", "ปีที่เริ่ม", { min: 1, max: 3000 }),
          num("year_to", "ปีที่จบ", { required: true, min: 1, max: 3000 }),
          text("degree", "วุฒิการศึกษา", { required: true }),
          text("major", "คณะ/สาขา", { required: true }),
          num("gpa", "เกรดเฉลี่ย", { min: 0, max: 4 }),
        ],
      },
      choice("education_status", "สถานะการศึกษาปัจจุบัน", opts([["not_studying", "ไม่ได้ศึกษาอยู่"], ["studying", "กำลังศึกษาอยู่"]])),
      text("studying_major", "คณะ/สาขาที่กำลังศึกษา", { showIf: when("education_status", "studying") }),
      text("studying_institute", "สถาบันที่กำลังศึกษา", { showIf: when("education_status", "studying") }),
      area("activities", "กิจกรรมระหว่างศึกษา"),
      area("training", "การฝึกอบรม"),
    ],
  },
  {
    id: "skills",
    title: "ทักษะ",
    fields: [
      area("relevant_skills", "ทักษะที่เกี่ยวข้องกับตำแหน่ง", { required: true }),
      {
        key: "languages", label: "ทักษะด้านภาษา", type: "list",
        defaultRows: () => [{ language: "ภาษาอังกฤษ", listening: null, speaking: null, reading: null, writing: null }],
        fields: [
          text("language", "ภาษา"),
          choice("listening", "ฟัง", RATING), choice("speaking", "พูด", RATING),
          choice("reading", "อ่าน", RATING), choice("writing", "เขียน", RATING),
        ],
      },
      {
        key: "computer_skills", label: "ทักษะคอมพิวเตอร์", type: "list",
        defaultRows: () => [{ name: "Microsoft Office", level: null }, { name: "ERP", level: null }],
        fields: [text("name", "โปรแกรม"), choice("level", "ระดับ", RATING)],
      },
      {
        key: "driving_licenses", label: "ใบขับขี่", type: "list",
        fields: [
          choice("type", "ประเภท", opts([["car", "รถยนต์"], ["motorcycle", "รถจักรยานยนต์"], ["truck", "รถบรรทุก"]])),
          text("license_no", "เลขที่ใบขับขี่"),
        ],
      },
      area("other_achievements", "ความสามารถ/ผลงานอื่นๆ"),
      text("hobbies", "งานอดิเรก"),
      text("sports", "กีฬา"),
    ],
  },
  {
    id: "experience",
    title: "ประสบการณ์ทำงาน",
    fields: [
      bool("has_work_experience", "มีประสบการณ์ทำงานหรือไม่", { required: true, yesNo: ["มี", "ไม่มี"] }),
      text("years_of_experience", "จำนวนปีที่มีประสบการณ์", { required: true }),
      {
        key: "current_job", label: "งานปัจจุบัน/งานล่าสุด", type: "group", showIf: when("has_work_experience", true),
        fields: [
          text("employer", "ชื่อนายจ้าง/บริษัท"), text("business_type", "ประเภทธุรกิจ"),
          area("address", "ที่อยู่"), text("phone", "เบอร์โทรศัพท์"),
          date("start_date", "วันที่เริ่มงาน"),
          text("first_position", "ตำแหน่งแรกเข้า"), text("current_position", "ตำแหน่งปัจจุบัน"),
          area("job_description", "ลักษณะงานที่ทำ"), text("reason_for_leaving", "เหตุผลที่ลาออก"),
          num("salary_start", "เงินเดือนแรกเข้า", { min: 0, unit: "บาท" }),
          num("salary_current", "เงินเดือนปัจจุบัน", { min: 0, unit: "บาท" }),
          num("allowance", "ค่าตอบแทนอื่นๆ", { min: 0, unit: "บาท" }),
          num("commission", "คอมมิชชั่น", { min: 0, unit: "บาท" }),
          num("other_income", "รายได้อื่นๆ", { min: 0, unit: "บาท" }),
        ],
      },
      {
        key: "employment_records", label: "ประวัติการทำงานที่ผ่านมา", type: "list",
        fields: [
          month("from", "ตั้งแต่"), month("to", "ถึง"),
          text("employer", "นายจ้าง/บริษัท"), text("position", "ตำแหน่ง"),
          num("salary", "เงินเดือน", { min: 0, unit: "บาท" }),
          text("reason_for_leaving", "เหตุผลที่ลาออก"),
        ],
      },
    ],
  },
  {
    id: "questions",
    title: "คำถามเพิ่มเติมและการยืนยัน",
    fields: [
      bool("criminal_record", "เคยมีประวัติคดีอาญาหรือไม่", { yesNo: ["เคย", "ไม่เคย"] }),
      text("criminal_record_detail", "ระบุรายละเอียด", { showIf: when("criminal_record", true) }),
      bool("credit_bureau_normal", "สถานะเครดิตบูโรปกติหรือไม่", { yesNo: ["ปกติ", "ไม่ปกติ"] }),
      text("credit_bureau_detail", "ระบุรายละเอียด", { showIf: when("credit_bureau_normal", false) }),
      bool("chronic_disease", "มีโรคประจำตัวหรือไม่", { yesNo: ["มี", "ไม่มี"] }),
      text("chronic_disease_detail", "ระบุรายละเอียด", { showIf: when("chronic_disease", true) }),
      bool("relatives_in_company", "มีญาติหรือบุคคลรู้จักทำงานในบริษัทนี้หรือไม่", { yesNo: ["มี", "ไม่มี"] }),
      text("relatives_detail", "ระบุรายละเอียด", { showIf: when("relatives_in_company", true) }),
      choice("social_security", "สิทธิประกันสังคม", opts([["has", "มีสิทธิ"], ["none_or_expired", "ไม่มี/หมดสิทธิ"]])),
      text("social_security_hospital", "โรงพยาบาลตามสิทธิ", { showIf: when("social_security", "has") }),
      bool("pdpa_consent", "ยินยอมให้เก็บและใช้ข้อมูลส่วนบุคคล (PDPA)", { required: true, format: "consent" }),
      text("signature_name", "ลงชื่อ (พิมพ์ชื่อ-นามสกุลของท่าน)", { required: true, format: "signature" }),
    ],
  },
]

export const STEP_COUNT = SECTIONS.length

function initialValue(f: Field): unknown {
  if (f.type === "list") return f.defaultRows ? f.defaultRows() : []
  if (f.type === "group") return Object.fromEntries((f.fields ?? []).map((c) => [c.key, initialValue(c)]))
  if (f.type === "number") return null
  if (f.type === "bool") return f.key === "credit_bureau_normal" ? true : f.required ? null : false
  return ""
}

/** a fresh, empty form (new objects every call) */
export function emptyForm(): ApplicationForm {
  return Object.fromEntries(SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, initialValue(f)]))
}

export function fieldByKey(key: string): Field | undefined {
  return SECTIONS.flatMap((s) => s.fields).find((f) => f.key === key)
}

export function optionLabel(field: Field, value: unknown): string {
  return field.options?.find((o) => o.value === value)?.label ?? String(value ?? "")
}

/** label maps by field key; list sub-fields use "<list>.<key>" (education.level ...) */
export const OPTION_LABELS: Record<string, Record<string, string>> = {}
for (const f of SECTIONS.flatMap((s) => s.fields)) {
  const add = (path: string, c: Field) => {
    if (c.options) OPTION_LABELS[path] = Object.fromEntries(c.options.map((o) => [String(o.value), o.label]))
  }
  add(f.key, f)
  for (const c of f.fields ?? []) add(`${f.key}.${c.key}`, c)
}

/** education levels, lowest to highest (the order of the `level` options) */
export const EDUCATION_LEVELS = SECTIONS.flatMap((s) => s.fields).find((f) => f.key === "education")?.fields?.find((f) => f.key === "level")?.options?.map((o) => o.value) ?? []

export function computeAge(dob: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob ?? "")
  if (!m) return null
  let age = now.getFullYear() - Number(m[1])
  const mo = now.getMonth() + 1
  if (mo < Number(m[2]) || (mo === Number(m[2]) && now.getDate() < Number(m[3]))) age--
  return age >= 0 ? age : null
}

export function isValidNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i)
  return (11 - (sum % 11)) % 10 === Number(id[12])
}

const isDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
}
const squash = (s: unknown) => String(s ?? "").replace(/\s+/g, "")

function validateValue(f: Field, v: unknown, path: string, form: ApplicationForm, errors: Errors) {
  const err = (msg: string) => { errors[path] = msg }
  if (f.format === "consent") return v === true ? undefined : err("กรุณายอมรับเงื่อนไขการเก็บและใช้ข้อมูลส่วนบุคคล")
  const empty = v == null || (typeof v === "string" && v.trim() === "")
  if (empty) {
    if (f.required) err(f.type === "text" || f.type === "textarea" || f.type === "number" ? `กรุณากรอก${f.label}` : `กรุณาเลือก${f.label}`)
    return
  }
  switch (f.type) {
    case "number":
      if (typeof v !== "number" || !Number.isFinite(v)) return err(`${f.label}ต้องเป็นตัวเลข`)
      if (f.positive && v <= 0) return err(`${f.label}ต้องมากกว่า 0`)
      if (f.min != null && v < f.min) return err(`${f.label}ต้องไม่น้อยกว่า ${f.min}`)
      if (f.max != null && v > f.max) return err(`${f.label}ต้องไม่เกิน ${f.max}`)
      return
    case "enum":
      if (!f.options?.some((o) => o.value === v)) return err(`${f.label}ไม่ถูกต้อง`)
      return
    case "date":
      if (typeof v !== "string" || !isDate(v)) return err(`${f.label}ไม่ถูกต้อง`)
      if (f.key === "date_of_birth" && (Number(v.slice(0, 4)) < 1900 || Number(v.slice(0, 4)) > new Date().getFullYear())) return err("ปีเกิดต้องเป็น ค.ศ.")
      return
    case "month":
      if (typeof v !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return err(`${f.label}ไม่ถูกต้อง`)
      return
    case "bool":
      if (typeof v !== "boolean") return err(`${f.label}ไม่ถูกต้อง`)
      return
  }
  const s = String(v).trim()
  if (f.format === "national_id" && !isValidNationalId(s)) err("เลขบัตรประชาชนไม่ถูกต้อง")
  if (f.format === "phone" && !/^\d{9,10}$/.test(s.replace(/[\s-]/g, ""))) err("เบอร์โทรศัพท์ต้องมี 9-10 หลัก")
  if (f.format === "postcode" && !/^\d{5}$/.test(s)) err("รหัสไปรษณีย์ต้องมี 5 หลัก")
  if (f.format === "thai" && !/^[ก-๏\s.-]+$/.test(s)) err(`${f.label}ต้องเป็นอักษรภาษาไทยเท่านั้น`)
  if (f.format === "english" && !/^[A-Za-z\s.'-]+$/.test(s)) err(`${f.label}ต้องเป็นอักษรภาษาอังกฤษเท่านั้น`)
  if (f.format === "letters" && !/^[ก-๏A-Za-z\s.()-]+$/.test(s)) err(`${f.label}ต้องเป็นตัวอักษรเท่านั้น`)
  if (f.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) err("อีเมลไม่ถูกต้อง")
  if (f.format === "signature" && squash(s) !== squash(`${form.first_name_th ?? ""} ${form.last_name_th ?? ""}`)) {
    err("ลายเซ็นต้องตรงกับชื่อ-นามสกุลที่กรอก")
  }
}

function validateFields(fields: Field[], data: Row, prefix: string, form: ApplicationForm, errors: Errors) {
  for (const f of fields) {
    if (f.showIf && !f.showIf(form)) continue
    const path = prefix + f.key
    const v = data?.[f.key]
    if (f.type === "list") {
      const rows = Array.isArray(v) ? (v as Row[]) : []
      if (f.required && rows.length < (f.minRows ?? 1)) errors[path] = `กรุณาเพิ่ม${f.label}อย่างน้อย ${f.minRows ?? 1} รายการ`
      rows.forEach((r, i) => validateFields(f.fields ?? [], r, `${path}.${i}.`, form, errors))
    } else if (f.type === "group") {
      validateFields(f.fields ?? [], (v ?? {}) as Row, path + ".", form, errors)
    } else validateValue(f, v, path, form, errors)
  }
}

/** step is 1-based (1 = position ... 8 = questions & consent). Returns { fieldPath: message }, empty = valid.
 *  Paths: "first_name_th", "education" (list min rows), "education.0.institute", "current_job.salary_current". */
export function validateStep(step: number, form: ApplicationForm): Errors {
  const errors: Errors = {}
  const s = SECTIONS[step - 1]
  if (s) validateFields(s.fields, form, "", form, errors)
  return errors
}

export function validateAll(form: ApplicationForm): Errors {
  return Object.assign({}, ...SECTIONS.map((_, i) => validateStep(i + 1, form)))
}

/** first 1-based step that has errors, or null */
export function firstInvalidStep(form: ApplicationForm): number | null {
  for (let i = 1; i <= STEP_COUNT; i++) if (Object.keys(validateStep(i, form)).length) return i
  return null
}
