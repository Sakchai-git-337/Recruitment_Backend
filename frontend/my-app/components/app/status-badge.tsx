import { cn } from "@/lib/utils"
import { APP_STATUS_LABEL, JOB_STATUS_LABEL, type AppStatus, type Job } from "@/lib/types"

// full class strings so Tailwind can see them
const TONE: Record<AppStatus, { chip: string; dot: string }> = {
  pending: { chip: "bg-muted text-foreground/80", dot: "bg-slate-400" },
  screening: { chip: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  interview: { chip: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  probation: { chip: "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300", dot: "bg-teal-500" },
  passed: { chip: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  rejected: { chip: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300", dot: "bg-red-500" },
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

/** `expired`: status is open but the closing date has passed */
export function JobStatusBadge({ status, expired, className }: { status: Job["status"]; expired?: boolean; className?: string }) {
  const open = status === "open" && !expired
  return (
    <span className={cn(chip, expired ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" : open ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-foreground/70", className)}>
      <span className={cn("size-1.5 rounded-full", expired ? "bg-amber-500" : open ? "bg-emerald-500" : "bg-slate-400")} />
      {expired ? "หมดเขต" : JOB_STATUS_LABEL[status]}
    </span>
  )
}
