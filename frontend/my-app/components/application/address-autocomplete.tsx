"use client"

import { useId, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Address data: [subdistrict, district, province, postcode] tuples in /public/thai-address.json,
// converted from github.com/earthchie/jquery.Thailand.js database (WTFPL). Fetched on first focus, not bundled.
export type AddressRow = [string, string, string, string]

let cache: Promise<AddressRow[]> | null = null
export function loadAddresses(): Promise<AddressRow[]> {
  cache ??= fetch("/thai-address.json").then((r) => r.json() as Promise<AddressRow[]>).catch(() => { cache = null; return [] })
  return cache
}

const norm = (s: string) => s.normalize("NFC").replace(/\s+/g, "")

/** subdistrict startsWith > includes, then district/province startsWith > includes; max `limit` */
export function searchAddresses(rows: AddressRow[], query: string, limit = 8): AddressRow[] {
  const q = norm(query)
  if (!q) return []
  const buckets: AddressRow[][] = [[], [], [], []]
  for (const r of rows) {
    const sub = norm(r[0])
    if (sub.startsWith(q)) buckets[0].push(r)
    else if (sub.includes(q)) buckets[1].push(r)
    else {
      const rest = [norm(r[1]), norm(r[2])]
      if (rest.some((x) => x.startsWith(q))) buckets[2].push(r)
      else if (rest.some((x) => x.includes(q))) buckets[3].push(r)
    }
    if (buckets[0].length >= limit) break
  }
  return buckets.flat().slice(0, limit)
}

/** shared by the combobox and the province datalist: loads once, on first call */
function useAddresses() {
  const [rows, setRows] = useState<AddressRow[]>([])
  const started = useRef(false)
  const load = () => {
    if (started.current) return
    started.current = true
    loadAddresses().then(setRows)
  }
  return [rows, load] as const
}

export function AddressAutocomplete({ id, value, invalid, onChange, onPick }: {
  id: string
  value: string
  invalid?: boolean
  onChange: (v: string) => void
  onPick: (row: AddressRow) => void
}) {
  const [rows, load] = useAddresses()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const matches = open ? searchAddresses(rows, value) : []
  const show = matches.length > 0

  const pick = (r: AddressRow) => { onPick(r); setOpen(false) }

  return (
    <div className="relative">
      <Input
        id={id} autoComplete="off" value={value} aria-invalid={invalid || undefined}
        role="combobox" aria-expanded={show} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={show ? `${listId}-${active}` : undefined}
        onFocus={load}
        onChange={(e) => { load(); onChange(e.target.value); setOpen(true); setActive(0) }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { if (show) { e.preventDefault(); setOpen(false) } return }
          if (!show) return
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length) }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length) }
          else if (e.key === "Enter") { e.preventDefault(); pick(matches[Math.min(active, matches.length - 1)]) }
        }}
      />
      {show && (
        <ul
          id={listId} role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-lg border bg-card py-1 shadow-lg"
        >
          {matches.map((r, i) => (
            <li
              key={r.join("|")} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(r) }} onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer px-3 py-2 text-sm text-foreground/80", i === active && "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300")}
            >
              <span className="font-medium">{r[0]}</span>
              <span className="text-muted-foreground"> › </span>{r[1]}
              <span className="text-muted-foreground"> › </span>{r[2]}
              {r[3] && <span className="ml-2 text-muted-foreground">{r[3]}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** plain input + native datalist of the 77 provinces (still free text) */
export function ProvinceInput({ id, value, invalid, onChange }: {
  id: string; value: string; invalid?: boolean; onChange: (v: string) => void
}) {
  const [rows, load] = useAddresses()
  const provinces = rows.length ? [...new Set(rows.map((r) => r[2]))].sort((a, b) => a.localeCompare(b, "th")) : []
  return (
    <>
      <Input id={id} autoComplete="off" list={`${id}-list`} value={value} aria-invalid={invalid || undefined}
        onFocus={load} onChange={(e) => onChange(e.target.value)} />
      <datalist id={`${id}-list`}>{provinces.map((p) => <option key={p} value={p} />)}</datalist>
    </>
  )
}
