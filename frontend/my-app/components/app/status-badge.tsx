import { cn } from "@/lib/utils"
import { APP_STATUS_LABEL, JOB_STATUS_LABEL, type AppStatus, type Job } from "@/lib/types"

// full class strings so Tailwind can see them
const TONE: Record<AppStatus, { chip: string; dot: string }> = {
  pending: { chip: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  screening: { chip: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  interview: { chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  passed: { chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  rejected: { chip: "bg-red-50 text-red-700", dot: "bg-red-500" },
}

const chip = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium"

export function StatusBadge({ status, className }: { status: AppStatus; className?: string }) {
  const t = TONE[status] ?? TONE.pending
  return (
    <span className={cn(chip, t.chip, className)}>
      <span className={cn("size-1.5 rounded-full", t.dot)} />
      {APP_STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function JobStatusBadge({ status, className }: { status: Job["status"]; className?: string }) {
  const open = status === "open"
  return (
    <span className={cn(chip, open ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600", className)}>
      <span className={cn("size-1.5 rounded-full", open ? "bg-emerald-500" : "bg-slate-400")} />
      {JOB_STATUS_LABEL[status]}
    </span>
  )
}
