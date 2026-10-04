import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function LoadingState({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-xl border bg-card p-5 shadow-xs", className)} aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn("h-5", i === 0 ? "w-1/3" : i % 2 ? "w-full" : "w-4/5")} />
      ))}
    </div>
  )
}

export function ErrorState({
  message = "โหลดข้อมูลไม่สำเร็จ", onRetry, className,
}: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center rounded-xl border border-red-100 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/10 px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
        <AlertCircle className="size-6" />
      </div>
      <p className="font-medium text-foreground">เกิดข้อผิดพลาด</p>
      <p className="mt-1 text-sm text-foreground/70">{message}</p>
      {onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}>ลองอีกครั้ง</Button>}
    </div>
  )
}
