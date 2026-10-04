import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function StatCard({
  label, value, icon: Icon, hint, className,
}: {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  hint?: string
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-xs", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
