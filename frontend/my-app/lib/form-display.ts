import { computeAge, optionLabel, type ApplicationForm, type Field, type Row } from "./application-form.ts"
import { formatDate, formatMoney } from "./format.ts"

export const isRow = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v)
export const asRow = (v: unknown): Row => (isRow(v) ? v : {})
export const asForm = (v: unknown): ApplicationForm => asRow(v)
export const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0)

function formatMonth(v: string) {
  const d = new Date(v + "-01T00:00")
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("th-TH", { month: "short", year: "numeric" })
}

/** render one stored value as text; never throws, falls back to String(v) when the type is not what the schema says */
export function display(f: Field, v: unknown): string {
  switch (f.type) {
    case "enum": return optionLabel(f, v)
    case "bool": return typeof v === "boolean" ? (v ? (f.yesNo?.[0] ?? "ใช่") : (f.yesNo?.[1] ?? "ไม่ใช่")) : String(v)
    case "date": {
      if (typeof v !== "string") return String(v)
      const age = f.key === "date_of_birth" ? computeAge(v) : null
      return formatDate(v) + (age != null ? ` (อายุ ${age} ปี)` : "")
    }
    case "month": return typeof v === "string" ? formatMonth(v) : String(v)
    case "number": {
      if (typeof v !== "number" || !Number.isFinite(v)) return String(v)
      const n = v.toLocaleString("en-US")
      return f.unit === "บาท" ? formatMoney(v) : f.unit ? `${n} ${f.unit}` : n
    }
    default: return typeof v === "object" ? JSON.stringify(v) : String(v)
  }
}
