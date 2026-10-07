import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_STATUS_LABEL, type AppStatus } from "@/lib/types"

const FLOW: AppStatus[] = ["pending", "screening", "interview", "passed"]
type State = "done" | "current" | "todo" | "rejected" | "passed" | "rejdone"

function Step({
  state, label, status, current, icon, line, lineDone, lineRed, onClick,
}: {
  state: State
  label: string
  status: AppStatus
  current: AppStatus
  icon: React.ReactNode
  line: boolean
  lineDone: boolean
  lineRed?: boolean
  onClick?: (s: AppStatus) => void
}) {
  const body = (
    <>
      <span
        className={cn(
          "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
          state === "done" && "border-indigo-600 bg-indigo-600 text-white",
          state === "current" && "border-indigo-600 bg-card text-indigo-600 dark:text-indigo-400 ring-4 ring-indigo-100 dark:ring-indigo-500/30",
          state === "rejdone" && "border-red-500 bg-red-50 text-red-600 dark:border-red-400 dark:bg-red-950 dark:text-red-300",
          state === "todo" && "border-border bg-card text-muted-foreground",
          state === "rejected" && "border-red-600 bg-red-600 text-white ring-4 ring-red-100 dark:ring-red-500/30",
          state === "passed" && "border-green-600 bg-green-600 text-white ring-4 ring-green-100 dark:ring-green-500/30",
        )}
      >
        {icon}
      </span>
      <span className={cn("mt-2 text-xs font-medium", state === "todo" ? "text-muted-foreground" : state === "rejected" ? "text-red-700 dark:text-red-300" : state === "passed" ? "text-green-700 dark:text-green-300" : "text-foreground")}>
        {label}
      </span>
    </>
  )
  return (
    <li className="relative flex flex-1 flex-col items-center">
      {line && <span className={cn("absolute top-4 left-1/2 h-0.5 w-full -translate-y-1/2", lineRed ? "bg-red-500 dark:bg-red-400" : lineDone ? "bg-indigo-600" : "bg-border")} />}
      {onClick ? (
        <button
          type="button"
          onClick={() => onClick(status)}
          aria-current={current === status ? "step" : undefined}
          className="relative flex flex-col items-center rounded-md outline-none hover:[&>span:first-child]:border-indigo-400 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {body}
        </button>
      ) : (
        <div className="relative flex flex-col items-center" aria-current={current === status ? "step" : undefined}>{body}</div>
      )}
    </li>
  )
}

/**
 * pending -> screening -> interview -> passed; rejected is a red terminal state.
 * `rejectedFrom` = stage it was rejected at: earlier steps stay done, a red line runs from that stage to "ไม่ผ่าน".
 * Clickable when `onChange` is given.
 */
export function StatusStepper({
  status, rejectedFrom, onChange, disabled, className,
}: {
  status: AppStatus
  rejectedFrom?: AppStatus | ""
  onChange?: (s: AppStatus) => void
  disabled?: boolean
  className?: string
}) {
  const rejected = status === "rejected"
  // rows rejected before the stage was recorded fall back to the first step
  const at = rejected ? FLOW.indexOf(rejectedFrom || "pending") : -1
  const cur = rejected ? at : FLOW.indexOf(status)
  const click = onChange && !disabled ? onChange : undefined
  const showRejected = rejected || !!onChange

  return (
    <ol className={cn("flex w-full items-start", className)}>
      {/* rejected: never show "ผ่าน"; applicant view also drops the steps after the rejection so the red line runs straight to "ไม่ผ่าน" */}
      {FLOW.filter((s, i) => !(rejected && (s === "passed" || (!onChange && i > at)))).map((s, i) => {
        // "passed" is a terminal state like "rejected": green check instead of the in-progress ring
        const state: State = rejected
          ? i < at ? "done" : i === at ? "rejdone" : "todo"
          : i < cur ? "done" : i === cur ? (s === "passed" ? "passed" : "current") : "todo"
        return (
          <Step
            key={s} state={state} label={APP_STATUS_LABEL[s]} status={s} current={status} onClick={click}
            icon={state === "done" || state === "passed" ? <Check className="size-4" /> : i + 1}
            line={showRejected || i < FLOW.length - 1}
            lineDone={i < cur} lineRed={rejected && i >= at}
          />
        )
      })}
      {showRejected && (
        <Step
          state={rejected ? "rejected" : "todo"} label={APP_STATUS_LABEL.rejected} status="rejected" current={status}
          onClick={click} icon={<X className="size-4" />} line={false} lineDone={false}
        />
      )}
    </ol>
  )
}
