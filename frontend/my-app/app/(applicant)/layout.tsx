import type { ReactNode } from "react"
import { RoleGate } from "@/components/app-ui"

export default function ApplicantLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate
      role="applicant"
      links={[
        { href: "/jobs", label: "งานที่เปิดรับ" },
        { href: "/my-applications", label: "งานที่ฉันสมัคร" },
      ]}
    >
      {children}
    </RoleGate>
  )
}
