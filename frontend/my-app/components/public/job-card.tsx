import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Job } from "@/lib/types"
import { MetaItem, TypeBadge, jobMeta } from "./job-utils"

export function JobCard({ job }: { job: Job }) {
  const m = jobMeta(job)
  return (
    <article className="group relative flex flex-col rounded-xl border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">
            <Link href={`/jobs/${job.job_id}`} className="after:absolute after:inset-0 hover:text-indigo-700">{job.title}</Link>
          </h3>
          {m.department && <p className="mt-0.5 text-sm text-slate-500">{m.department.text}</p>}
        </div>
        <TypeBadge type={job.employment_type} />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {m.location && <MetaItem icon={m.location.icon}>{m.location.text}</MetaItem>}
        <MetaItem icon={m.salary.icon}><span className="font-medium text-slate-900">{m.salary.text}</span></MetaItem>
        {m.closing && <MetaItem icon={m.closing.icon}>{m.closing.text}</MetaItem>}
      </div>
      <div className="mt-5 flex flex-1 items-end">
        <Button variant="outline" size="sm" tabIndex={-1} className="pointer-events-none group-hover:border-indigo-300 group-hover:text-indigo-700">
          ดูรายละเอียด <ArrowRight />
        </Button>
      </div>
    </article>
  )
}
