import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/** label + control + error text. Give the control the same `id`. */
export function FormField({
  label, id, required, error, hint, className, children,
}: {
  label: string
  id?: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium text-foreground/80">
        {label}
        {required && <span className="ml-0.5 text-red-500 dark:text-red-400" aria-hidden="true">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
