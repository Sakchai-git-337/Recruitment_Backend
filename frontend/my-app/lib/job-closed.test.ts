import { test } from "node:test"
import assert from "node:assert/strict"
import { showClosedNotice } from "./job-closed.ts"

const T = "2026-10-04"
test("closed job shows notice for in-progress apps only", () => {
  for (const status of ["pending", "screening", "interview"]) assert.equal(showClosedNotice({ status, job_status: "closed" }, T), true)
  for (const status of ["passed", "rejected"]) assert.equal(showClosedNotice({ status, job_status: "closed" }, T), false)
})
test("closing date: past shows, today/future/null/missing do not", () => {
  assert.equal(showClosedNotice({ status: "pending", job_status: "open", job_closing_date: "2026-10-03" }, T), true)
  assert.equal(showClosedNotice({ status: "pending", job_status: "open", job_closing_date: T }, T), false)
  assert.equal(showClosedNotice({ status: "pending", job_status: "open", job_closing_date: "2030-01-01" }, T), false)
  assert.equal(showClosedNotice({ status: "pending", job_status: "open", job_closing_date: null }, T), false)
  assert.equal(showClosedNotice({ status: "pending" }, T), false)
})
