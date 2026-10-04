"use client"

import { PageHeader } from "@/components/app/page-header"
import { JobForm } from "@/components/admin/jobs/job-form"

export default function NewJobPage() {
  return (
    <>
      <PageHeader title="สร้างตำแหน่งงาน" breadcrumb={[{ label: "ตำแหน่งงาน", href: "/admin/jobs" }, { label: "สร้างใหม่" }]} />
      <JobForm />
    </>
  )
}
