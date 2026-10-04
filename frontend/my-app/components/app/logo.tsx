import Link from "next/link"
import { Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 font-semibold tracking-tight text-foreground", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
        <Briefcase className="size-4" />
      </span>
      <span className="text-lg">Recruit</span>
    </Link>
  )
}
