"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api, useUser } from "@/lib/api"
import type { Application, Interview, Job } from "@/lib/types"
import { ErrorText, Loading, StatusBar } from "@/components/app-ui"

export default function MyApplicationsPage() {
  const me = useUser()
  const [data, setData] = useState<{ apps: Application[]; jobs: Job[]; interviews: Interview[] } | null>(null)
  const [error, setError] = useState("")
  const uid = me?.user_id

  useEffect(() => {
    if (uid === undefined) return
    let live = true
    Promise.all([
      api<Application[] | null>(`/applications?user_id=${uid}`),
      api<Job[] | null>("/jobs"),
      api<Interview[] | null>("/interviews"),
    ])
      .then(([a, j, i]) => {
        if (live) setData({ apps: a ?? [], jobs: j ?? [], interviews: i ?? [] })
      })
      .catch((e: Error) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [uid])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">ใบสมัครของฉัน</h1>
      <ErrorText message={error} />
      {data === null ? (
        error ? null : <Loading />
      ) : data.apps.length === 0 ? (
        <p className="text-sm text-gray-500">
          ยังไม่ได้สมัครงาน{" "}
          <Link href="/jobs" className="text-sky-600 underline">
            ดูตำแหน่งงาน
          </Link>
        </p>
      ) : (
        data.apps.map((a) => {
          const job = data.jobs.find((j) => j.job_id === a.job_id)
          const meets = data.interviews.filter((i) => i.application_id === a.application_id && i.status === "scheduled")
          return (
            <div key={a.application_id} className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">{job?.title ?? `ตำแหน่ง #${a.job_id}`}</h2>
              <p className="text-sm text-gray-500">
                {job?.location ? `${job.location} · ` : ""}สมัครเมื่อ {new Date(a.apply_date).toLocaleDateString("th-TH")}
              </p>
              <StatusBar value={a.status} />
              {meets.map((i) => (
                <p key={i.interview_id} className="text-sm text-amber-700">
                  นัดสัมภาษณ์ {new Date(i.interview_date + "T00:00").toLocaleDateString("th-TH")} เวลา {i.interview_time.slice(0, 5)}
                </p>
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}
