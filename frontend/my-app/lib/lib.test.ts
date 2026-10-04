import { test } from "node:test"
import assert from "node:assert/strict"
import { countByStatus, groupByStatus, type Application } from "./types.ts"
import { api } from "./api.ts"

const app = (id: number, status: Application["status"]): Application => ({
  application_id: id, user_id: 1, job_id: 1, apply_date: "", status, note: "",
})

test("countByStatus counts each status, zero when missing", () => {
  assert.deepEqual(countByStatus([app(1, "pending"), app(2, "pending"), app(3, "passed")]), {
    pending: 2, screening: 0, interview: 0, passed: 1, rejected: 0,
  })
})

test("groupByStatus ignores unknown status", () => {
  const g = groupByStatus([app(1, "interview"), app(2, "weird" as Application["status"])])
  assert.equal(g.interview.length, 1)
  assert.equal(Object.values(g).flat().length, 1)
})

test("api: network failure -> Thai message, status 0", async () => {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch") }
  await assert.rejects(api("/jobs"), { message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", status: 0 })
})

test("api: backend JSON error is surfaced with status", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 })
  await assert.rejects(api("/login", { method: "POST", body: {} }), { message: "Invalid email or password", status: 401 })
})

test("api: non-JSON 404 falls back to generic message", async () => {
  globalThis.fetch = async () => new Response("404 page not found", { status: 404 })
  await assert.rejects(api("/login"), { message: "เกิดข้อผิดพลาด (404)", status: 404 })
})

test("api: null body on 200 resolves null", async () => {
  globalThis.fetch = async () => new Response("null", { status: 200 })
  assert.equal(await api("/jobs"), null)
})

test("api: sends JSON body and method", async () => {
  let seen: RequestInit | undefined
  globalThis.fetch = async (_url, init) => { seen = init; return new Response("{}", { status: 200 }) }
  await api("/jobs", { method: "POST", body: { a: 1 } })
  assert.equal(seen?.method, "POST")
  assert.equal(seen?.body, '{"a":1}')
})
