"use client"

import { useRef, useState } from "react"
import { CheckCircle2, FileText, UploadCloud, X } from "lucide-react"
import { formatBytes } from "@/lib/format"
import { cn } from "@/lib/utils"

export const MAX_FILE = 10 * 1024 * 1024
const OK_TYPES = ["application/pdf", "image/jpeg", "image/png"]
const OK_EXT = /\.(pdf|jpe?g|png)$/i

/** client-side mirror of the server's per-file rules */
export function checkFile(f: File): string | null {
  if (!OK_TYPES.includes(f.type) && !OK_EXT.test(f.name)) return `${f.name}: ไฟล์ต้องเป็น PDF, JPG หรือ PNG`
  if (f.size > MAX_FILE) return `${f.name}: ไฟล์ใหญ่เกินไป (สูงสุด 10 MB)`
  return null
}

export function FileDrop({
  id, label, required, multiple, files, onChange, onReject, canAdd, error,
}: {
  id?: string
  label: string
  required?: boolean
  multiple?: boolean
  files: File[]
  onChange: (files: File[]) => void
  onReject: (msg: string) => void
  /** extra whole-submission checks (total size, file count) */
  canAdd?: (f: File, pending: File[]) => string | null
  error?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  function add(list: FileList | null) {
    if (!list) return
    let next = multiple ? [...files] : []
    for (const f of Array.from(list)) {
      const bad = checkFile(f) ?? canAdd?.(f, next)
      if (bad) { onReject(bad); continue }
      next = multiple ? [...next, f] : [f]
    }
    onChange(next)
  }

  const has = files.length > 0
  return (
    <div className="space-y-2">
      <div
        id={id} role="button" tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click() } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-card px-4 py-3 outline-none transition-colors hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10 focus-visible:ring-3 focus-visible:ring-ring/50",
          has && !multiple && "border-solid border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/10",
          over && "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10", error && "border-red-400",
        )}
      >
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", has ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400")}>
          {has ? <CheckCircle2 className="size-5" /> : <UploadCloud className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {label}{required && <span className="ml-0.5 text-red-500 dark:text-red-400">*</span>}
          </p>
          <p className="text-xs text-muted-foreground">ลากไฟล์มาวาง หรือคลิกเลือก · PDF/JPG/PNG ≤ 10 MB</p>
        </div>
        <input
          ref={input} type="file" hidden multiple={multiple} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(e) => { add(e.target.files); e.target.value = "" }}
        />
      </div>
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-foreground">{f.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)}</span>
          <button
            type="button" aria-label={`ลบไฟล์ ${f.name}`}
            className="rounded p-0.5 text-muted-foreground hover:bg-border hover:text-red-600 dark:hover:text-red-400"
            onClick={() => onChange(files.filter((_, j) => j !== i))}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
