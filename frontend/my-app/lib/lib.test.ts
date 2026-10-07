import { test } from "node:test"
import assert from "node:assert/strict"
import { countByStatus, groupByStatus, type Application } from "./types.ts"
import { api, apiUpload, logout, setSession } from "./api.ts"
import { safeNext } from "./safe-next.ts"
import { initials } from "./format.ts"

const app = (id: number, status: Application["status"]): Application => ({
  application_id: id, user_id: 1, job_id: 1, apply_date: "", status, note: "",
})

test("countByStatus counts each status, zero when missing", () => {
  assert.deepEqual(countByStatus([app(1, "pending"), app(2, "pending"), app(3, "passed")]), {
    pending: 2, screening: 0, interview: 0, probation: 0, passed: 1, rejected: 0,
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

function stubStorage(init: Record<string, string>) {
  const m = new Map(Object.entries(init))
  globalThis.localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as unknown as Storage
  return m
}

test("api: stored token is sent as Bearer Authorization", async () => {
  stubStorage({ token: "tok" })
  let seen: RequestInit | undefined
  globalThis.fetch = async (_url, init) => { seen = init; return new Response("{}", { status: 200 }) }
  await api("/jobs")
  assert.equal((seen?.headers as Record<string, string>).Authorization, "Bearer tok")
})

test("api: 401 clears stored token and user", async () => {
  const m = stubStorage({ token: "tok", user: "{}" })
  globalThis.window = { dispatchEvent: () => true } as unknown as Window & typeof globalThis
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
  await assert.rejects(api("/jobs"), { status: 401 })
  assert.equal(m.has("token"), false)
  assert.equal(m.has("user"), false)
})

test("apiUpload: sends FormData without JSON content type, with Bearer", async () => {
  stubStorage({ token: "tok" })
  let seen: RequestInit | undefined
  globalThis.fetch = async (_url, init) => { seen = init; return new Response("{}", { status: 201 }) }
  const fd = new FormData()
  fd.append("job_id", "1")
  await apiUpload("/applications", fd)
  assert.equal(seen?.body, fd)
  const h = seen?.headers as Record<string, string>
  assert.equal(h.Authorization, "Bearer tok")
  assert.equal(h["Content-Type"], undefined)
})

test("401 redirects to /login unless already there", async () => {
  stubStorage({ token: "tok" })
  const assigned: string[] = []
  globalThis.window = {
    dispatchEvent: () => true,
    location: { pathname: "/jobs/3/apply", search: "?a=1", assign: (u: string) => assigned.push(u) },
  } as unknown as Window & typeof globalThis
  globalThis.fetch = async () => new Response("{}", { status: 401 })
  await assert.rejects(api("/jobs"), { status: 401 })
  assert.deepEqual(assigned, ["/login?next=" + encodeURIComponent("/jobs/3/apply?a=1")])
  ;(globalThis.window.location as { pathname: string }).pathname = "/login"
  await assert.rejects(api("/login"), { status: 401 })
  assert.equal(assigned.length, 1)
})

test("logout clears apply drafts", () => {
  const m = stubStorage({ token: "t", user: "{}", "apply-draft-3": "{}", other: "x" })
  ;(globalThis.localStorage as unknown as { length: number; key: (i: number) => string | null }).length = m.size
  ;(globalThis.localStorage as unknown as { key: (i: number) => string | null }).key = (i) => [...m.keys()][i] ?? null
  globalThis.window = { dispatchEvent: () => true } as unknown as Window & typeof globalThis
  logout()
  assert.deepEqual([...m.keys()], ["other"])
})

test("401 keeps apply drafts; setSession drops other users' drafts only", async () => {
  const m = stubStorage({ token: "t", user: "{}", "apply-draft-7-3": "{}", "apply-draft-8-3": "{}" })
  const ls = globalThis.localStorage as unknown as { length: number; key: (i: number) => string | null }
  ls.length = m.size
  ls.key = (i) => [...m.keys()][i] ?? null
  globalThis.window = { dispatchEvent: () => true } as unknown as Window & typeof globalThis
  globalThis.fetch = async () => new Response("{}", { status: 401 })
  await assert.rejects(api("/jobs"), { status: 401 })
  assert.deepEqual([...m.keys()].sort(), ["apply-draft-7-3", "apply-draft-8-3"])
  ls.length = m.size
  setSession("t2", { user_id: 7, full_name: "a", email: "a@b.c", phone: "", role: "applicant" })
  assert.deepEqual([...m.keys()].sort(), ["apply-draft-7-3", "token", "user"])
})

test("safeNext accepts same-site paths only", () => {
  assert.equal(safeNext("/jobs/1/apply?x=1"), "/jobs/1/apply?x=1")
  for (const bad of [null, "", "https://evil.com", "//evil.com", "/\\evil.com", "/a\\b", "/a\nb", "/a\tb", "/\x00"]) assert.equal(safeNext(bad), null)
})

test("initials skips Thai leading vowels", () => {
  assert.equal(initials("เอกชัย"), "อ")
  assert.equal(initials("แสงดาว ใจดี"), "สจ")
  assert.equal(initials("Ann Lee"), "AL")
  assert.equal(initials("  "), "?")
})
