"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Row } from "@/lib/application-form"

/** rows of fields with "+ เพิ่ม" / remove. The caller renders a row and reports patches. */
export function RepeatableList({
  label, rows, makeRow, onChange, renderRow, minRows = 0, error, addLabel = "เพิ่ม",
}: {
  label: string
  rows: Row[]
  makeRow: () => Row
  onChange: (rows: Row[]) => void
  renderRow: (row: Row, index: number, patch: (p: Row) => void) => React.ReactNode
  minRows?: number
  error?: string
  addLabel?: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, makeRow()])}>
          <Plus className="size-4" /> {addLabel}
        </Button>
      </div>
      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-slate-400">ยังไม่มีรายการ</p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="rounded-lg border bg-slate-50/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">รายการที่ {i + 1}</span>
            {rows.length > minRows && (
              <Button
                type="button" variant="ghost" size="sm" aria-label={`ลบรายการที่ ${i + 1}`}
                className="h-7 text-slate-500 hover:text-red-600"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" /> ลบ
              </Button>
            )}
          </div>
          {renderRow(row, i, (p) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r))))}
        </div>
      ))}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
