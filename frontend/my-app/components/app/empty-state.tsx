import type { LucideIcon } from "lucide-react"
import { Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon = Inbox, title, text, action, className,
}: {
  icon?: LucideIcon
  title: string
  text?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-14 text-center", className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
