/** local (Bangkok-user) calendar date as YYYY-MM-DD */
export const localToday = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** true when the applicant should see "recruitment closed but still under review" */
export function showClosedNotice(
  app: { status: string; job_status?: string; job_closing_date?: string | null },
  today = localToday(),
): boolean {
  if (app.status === "passed" || app.status === "rejected") return false
  return app.job_status === "closed" || (!!app.job_closing_date && app.job_closing_date < today)
}
