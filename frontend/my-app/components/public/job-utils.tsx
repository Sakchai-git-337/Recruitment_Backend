import { Banknote, Building2, CalendarClock, MapPin, Users, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatSalaryRange } from "@/lib/format"
import { EMPLOYMENT_TYPE_LABEL, type Job } from "@/lib/types"

/** open and not past its closing date (date-only, local time, closing day inclusive) */
export function isJobOpen(job: Job, now = new Date()): boolean {
  if (job.status !== "open") return false
  if (!job.closing_date) return true
  const end = new Date(job.closing_date + "T23:59:59")
  return isNaN(end.getTime()) || end >= now
}

export function TypeBadge({ type }: { type: Job["employment_type"] }) {
  return (
    <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
      {EMPLOYMENT_TYPE_LABEL[type] ?? type}
    </Badge>
  )
}

export function MetaItem({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-foreground/70">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">{children}</span>
    </span>
  )
}

export function jobMeta(job: Job) {
  return {
    department: job.department ? { icon: Building2, text: job.department } : null,
    location: job.location ? { icon: MapPin, text: job.location } : null,
    salary: { icon: Banknote, text: formatSalaryRange(job.salary_min, job.salary_max) },
    headcount: { icon: Users, text: `รับ ${job.headcount} อัตรา` },
    closing: job.closing_date ? { icon: CalendarClock, text: `ปิดรับ ${formatDate(job.closing_date)}` } : null,
  }
}
