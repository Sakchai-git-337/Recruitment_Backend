import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_STATUS_LABEL, type AppStatus } from "@/lib/types"

const FLOW: AppStatus[] = ["pending", "screening", "interview", "passed"]
type State = "done" | "current" | "todo" | "rejected"

function Step({
  state, label, status, current, icon, line, lineDone, onClick,
}: {
  state: State
  label: string
  status: AppStatus
  current: AppStatus
  icon: React.ReactNode
  line: boolean
  lineDone: boolean
  onClick?: (s: AppStatus) => void
}) {
  const body = (
    <>
      <span
        className={cn(
          "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
          state === "done" && "border-indigo-600 bg-indigo-600 text-white",
          state === "current" && "border-indigo-600 bg-white text-indigo-600 ring-4 ring-indigo-100",
          state === "todo" && "border-slate-200 bg-white text-slate-400",
          state === "rejected" && "border-red-600 bg-red-600 text-white ring-4 ring-red-100",
        )}
      >
        {icon}
      </span>
      <span className={cn("mt-2 text-xs font-medium", state === "todo" ? "text-slate-400" : state === "rejected" ? "text-red-700" : "text-slate-900")}>
        {label}
      </span>
    </>
  )
  return (
    <li className="relative flex flex-1 flex-col items-center">
      {line && <span className={cn("absolute top-4 left-1/2 h-0.5 w-full -translate-y-1/2", lineDone ? "bg-indigo-600" : "bg-slate-200")} />}
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

/** pending -> screening -> interview -> passed; rejected is a red terminal state. Clickable when `onChange` is given. */
export function StatusStepper({
  status, onChange, disabled, className,
}: {
  status: AppStatus
  onChange?: (s: AppStatus) => void
  disabled?: boolean
  className?: string
}) {
  const rejected = status === "rejected"
  const cur = FLOW.indexOf(status)
  const click = onChange && !disabled ? onChange : undefined
  const showRejected = rejected || !!onChange

  return (
    <ol className={cn("flex w-full items-start", className)}>
      {FLOW.map((s, i) => {
        const state: State = rejected ? "todo" : i < cur ? "done" : i === cur ? "current" : "todo"
        return (
          <Step
            key={s} state={state} label={APP_STATUS_LABEL[s]} status={s} current={status} onClick={click}
            icon={state === "done" ? <Check className="size-4" /> : i + 1}
            line={showRejected || i < FLOW.length - 1}
            lineDone={!rejected && i < cur}
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
