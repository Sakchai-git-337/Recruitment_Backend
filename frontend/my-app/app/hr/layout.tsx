import type { ReactNode } from "react"
import { RoleGate } from "@/components/app-ui"

export default function HrLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate role="recruitment" links={[{ href: "/hr/jobs", label: "ตำแหน่งงาน" }]}>
      {children}
    </RoleGate>
  )
}
