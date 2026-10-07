import Link from "next/link"
import { cn } from "@/lib/utils"

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 font-semibold tracking-tight text-foreground", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="size-8 rounded-full shadow-xs ring-1 ring-border" />
      <span className="text-lg">MAIRU</span>
    </Link>
  )
}
