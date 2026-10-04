"use client"

import { useParams } from "next/navigation"
import { RequireRole } from "@/components/app/require-role"
import { ApplicationWizard } from "@/components/application/wizard"

export default function ApplyPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <RequireRole role="applicant">
      <ApplicationWizard jobId={id} />
    </RequireRole>
  )
}
