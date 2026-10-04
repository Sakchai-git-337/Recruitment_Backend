import { SECTIONS, computeAge, optionLabel, type ApplicationForm, type Field, type Row } from "@/lib/application-form"
import { formatDate, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0)

function formatMonth(v: string) {
  const d = new Date(v + "-01T00:00")
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("th-TH", { month: "short", year: "numeric" })
}

function display(f: Field, v: unknown): string {
  switch (f.type) {
    case "enum": return optionLabel(f, v)
    case "bool": return v ? (f.yesNo?.[0] ?? "ใช่") : (f.yesNo?.[1] ?? "ไม่ใช่")
    case "date": {
      const age = f.key === "date_of_birth" ? computeAge(String(v)) : null
      return formatDate(String(v)) + (age != null ? ` (อายุ ${age} ปี)` : "")
    }
    case "month": return formatMonth(String(v))
    case "number": {
      const n = Number(v)
      const money = f.unit === "บาท" ? formatMoney(n) : n.toLocaleString("en-US")
      return f.unit && f.unit !== "บาท" ? `${money} ${f.unit}` : money
    }
    default: return String(v)
  }
}

function Item({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2 lg:col-span-3")}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm break-words whitespace-pre-wrap text-slate-900">{children}</dd>
    </div>
  )
}

function ListTable({ f, rows }: { f: Field; rows: Row[] }) {
  const cols = (f.fields ?? []).filter((c) => rows.some((r) => !isEmpty(r[c.key])))
  if (cols.length === 0) return null
  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <p className="mb-1.5 text-xs font-medium text-slate-500">{f.label}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>{cols.map((c) => <th key={c.key} className="px-3 py-2 font-medium whitespace-nowrap">{c.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={i} className="break-inside-avoid">
                {cols.map((c) => (
                  <td key={c.key} className="px-3 py-2 align-top text-slate-900">
                    {isEmpty(r[c.key]) ? "-" : display(c, r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Fields({ fields, data, form }: { fields: Field[]; data: Row; form: ApplicationForm }) {
  return (
    <>
      {fields.map((f) => {
        if (f.showIf && !f.showIf(form)) return null
        const v = data?.[f.key]
        if (f.type === "list") return Array.isArray(v) ? <ListTable key={f.key} f={f} rows={v as Row[]} /> : null
        if (f.type === "group") {
          const g = (v ?? {}) as Row
          if (!(f.fields ?? []).some((c) => !isEmpty(g[c.key]))) return null
          return (
            <div key={f.key} className="sm:col-span-2 lg:col-span-3">
              <p className="mb-2 text-xs font-medium text-slate-500">{f.label}</p>
              <div className="grid gap-x-6 gap-y-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <Fields fields={f.fields ?? []} data={g} form={form} />
              </div>
            </div>
          )
        }
        if (isEmpty(v)) return null
        return <Item key={f.key} label={f.label} wide={f.type === "textarea"}>{display(f, v)}</Item>
      })}
    </>
  )
}

/** read-only render of a submitted application form (spec 6), driven by SECTIONS. Empty optional fields are hidden. */
export function FormViewer({ data, consentAt, className }: { data: ApplicationForm; consentAt?: string; className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {SECTIONS.map((s) => (
        <section key={s.id} className="rounded-xl border bg-card p-5 shadow-xs break-inside-avoid-page print:rounded-none print:shadow-none">
          <h3 className="mb-4 border-b pb-3 text-sm font-semibold text-slate-900">{s.title}</h3>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fields fields={s.fields} data={data} form={data} />
          </dl>
        </section>
      ))}
      {consentAt && <p className="text-xs text-slate-500">ยินยอมให้เก็บและใช้ข้อมูลส่วนบุคคล เมื่อ {formatDate(consentAt)}</p>}
    </div>
  )
}
