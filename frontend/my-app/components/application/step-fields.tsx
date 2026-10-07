"use client"

import { computeAge, type ApplicationForm, type Errors, type Field, type Row } from "@/lib/application-form"
import { FormField } from "@/components/app/form-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { AddressAutocomplete, ProvinceInput } from "./address-autocomplete"
import { RepeatableList } from "./repeatable-list"

type Opt = { value: string | number | boolean; label: string }

function Pills({ options, value, onChange, id }: {
  options: Opt[]; value: unknown; onChange: (v: unknown) => void; id: string
}) {
  return (
    <div id={id} role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={String(o.value)} type="button" role="radio" aria-checked={on}
            onClick={() => onChange(on && typeof o.value !== "boolean" ? (typeof o.value === "number" ? null : "") : o.value)}
            className={cn(
              "h-9 rounded-lg border px-3.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 font-medium text-indigo-700 dark:text-indigo-300" : "bg-card text-foreground/80 hover:border-muted-foreground/60",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Control({ f, value, onChange, id, invalid, disabled, onPatch }: {
  f: Field; value: unknown; onChange: (v: unknown) => void; id: string; invalid: boolean; disabled?: boolean
  /** set sibling keys (address autocomplete) */
  onPatch?: (key: string, v: unknown) => void
}) {
  const aria = { "aria-invalid": invalid || undefined }
  switch (f.type) {
    case "textarea":
      return <Textarea id={id} rows={3} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} {...aria} />
    case "number":
      return (
        <div className="relative">
          <Input
            id={id} type="number" inputMode="decimal" min={f.min} max={f.max} step="any"
            className={f.unit ? "pr-14" : undefined} value={value == null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} {...aria}
          />
          {f.unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{f.unit}</span>}
        </div>
      )
    case "date":
    case "month":
      return <Input id={id} type={f.type} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} {...aria} />
    case "bool":
      return (
        <Pills id={id} value={value} onChange={onChange}
          options={[{ value: true, label: f.yesNo?.[0] ?? "ใช่" }, { value: false, label: f.yesNo?.[1] ?? "ไม่ใช่" }]} />
      )
    case "enum": {
      const opts = f.options ?? []
      if (opts.length <= 4 && f.key !== "level") return <Pills id={id} value={value} options={opts} onChange={onChange} />
      return (
        <Select
          value={value == null ? "" : String(value)}
          onValueChange={(v) => onChange(opts.find((x) => String(x.value) === v)?.value ?? v)}
        >
          <SelectTrigger id={id} className="w-full" {...aria}><SelectValue placeholder="เลือก" /></SelectTrigger>
          <SelectContent>{opts.map((o) => <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      )
    }
    default: {
      if (f.widget === "thai-address" && onPatch) {
        const pre = f.key.replace(/subdistrict$/, "")
        return (
          <AddressAutocomplete id={id} value={String(value ?? "")} invalid={invalid} onChange={onChange}
            onPick={([sub, dist, prov, zip]) => {
              onChange(sub); onPatch(pre + "district", dist); onPatch(pre + "province", prov); onPatch(pre + "postcode", zip)
            }} />
        )
      }
      if (f.widget === "thai-province") return <ProvinceInput id={id} value={String(value ?? "")} invalid={invalid} onChange={onChange} />
      const inputMode = f.format === "phone" ? "tel" : f.format === "postcode" ? "numeric" : f.format === "national_id" ? "numeric" : f.format === "decimal" ? "decimal" : f.format === "email" ? "email" : undefined
      return (
        <Input
          id={id} type={f.format === "email" ? "email" : "text"} inputMode={inputMode}
          maxLength={f.format === "national_id" ? 13 : f.format === "postcode" ? 5 : undefined} autoComplete="off" disabled={disabled}
          value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} {...aria}
        />
      )
    }
  }
}

const blankValue = (c: Field) => (c.type === "number" || c.type === "enum" && typeof c.options?.[0]?.value === "number" ? null : "")

/** renders field definitions as a responsive 2-column grid; lists and groups recurse */
export function FieldGrid({ fields, data, form, errors, prefix = "", onChange }: {
  fields: Field[]
  data: Row
  form: ApplicationForm
  errors: Errors
  prefix?: string
  onChange: (key: string, v: unknown) => void
}) {
  return (
    <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
      {fields.filter((f) => !f.showIf || f.showIf(form)).map((f) => {
        const path = prefix + f.key
        const id = "f-" + path.replace(/\./g, "-")
        if (f.type === "list") {
          const rows = (Array.isArray(data[f.key]) ? data[f.key] : []) as Row[]
          return (
            <div key={f.key} id={id} className="sm:col-span-2">
              <RepeatableList
                label={<>{f.label}{f.required && <span className="ml-0.5 text-red-500 dark:text-red-400" aria-hidden="true">*</span>}</>} rows={rows} minRows={f.minRows ?? 0} error={errors[path]}
                makeRow={() => Object.fromEntries((f.fields ?? []).map((c) => [c.key, blankValue(c)]))}
                onChange={(r) => onChange(f.key, r)}
                renderRow={(row, i, patch) => (
                  <FieldGrid fields={f.fields ?? []} data={row} form={form} errors={errors} prefix={`${path}.${i}.`}
                    onChange={(k, v) => patch({ [k]: v })} />
                )}
              />
            </div>
          )
        }
        if (f.type === "group") {
          const g = (data[f.key] ?? {}) as Row
          return (
            <div key={f.key} className="rounded-lg border bg-muted/60 p-4 sm:col-span-2">
              <p className="mb-4 text-sm font-medium text-foreground/80">{f.label}</p>
              <FieldGrid fields={f.fields ?? []} data={g} form={form} errors={errors} prefix={path + "."}
                onChange={(k, v) => onChange(f.key, { ...g, [k]: v })} />
            </div>
          )
        }
        const age = f.key === "date_of_birth" && typeof data[f.key] === "string" ? computeAge(data[f.key] as string) : null
        return (
          <FormField key={f.key} id={id} label={f.label} required={f.required} error={errors[path]}
            hint={f.type === "date" ? `(ปี ค.ศ.)${age != null ? ` อายุ ${age} ปี` : ""}` : undefined} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
            <Control f={f} id={id} value={data[f.key]} invalid={!!errors[path]} disabled={f.disabledIf?.(form)} onChange={(v) => onChange(f.key, v)} onPatch={onChange} />
          </FormField>
        )
      })}
    </div>
  )
}
