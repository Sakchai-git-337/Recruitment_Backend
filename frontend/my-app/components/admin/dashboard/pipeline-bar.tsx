import { APP_STATUSES, APP_STATUS_LABEL, type AppStatus } from "@/lib/types"

const BAR: Record<AppStatus, string> = {
  pending: "bg-slate-400", screening: "bg-sky-500", interview: "bg-amber-500", passed: "bg-emerald-500", rejected: "bg-red-500",
}

export function PipelineBar({ counts }: { counts: Record<AppStatus, number> }) {
  const total = APP_STATUSES.reduce((n, s) => n + counts[s], 0)
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {total > 0 && APP_STATUSES.map((s) => counts[s] > 0 && (
          <div key={s} className={BAR[s]} style={{ width: `${(counts[s] / total) * 100}%` }} title={`${APP_STATUS_LABEL[s]} ${counts[s]}`} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {APP_STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${BAR[s]}`} />
            <span className="text-sm text-muted-foreground">{APP_STATUS_LABEL[s]}</span>
            <span className="ml-auto text-sm font-semibold tabular-nums text-foreground sm:ml-1">{counts[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
