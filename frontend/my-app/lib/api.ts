import { useMemo, useSyncExternalStore } from "react"
import type { User } from "./types.ts"

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export class ApiError extends Error {
  status: number
  /** server key path the error is about (application submit), e.g. "education.0.level" */
  field?: string
  constructor(message: string, status: number, field?: string) {
    super(message)
    this.status = status
    this.field = field
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
  const tok = getToken()
  if (tok) headers.Authorization = `Bearer ${tok}`
  let res: Response
  try {
    res = await fetch(BASE + path, { ...init, headers })
  } catch {
    throw new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", 0)
  }
  if (res.status === 401) onUnauthorized()
  return res
}

function onUnauthorized() {
  clearSession() // keep drafts: the user logs back in and continues
  if (typeof window !== "undefined" && window.location?.pathname && !window.location.pathname.startsWith("/login")) {
    const here = window.location.pathname + (window.location.search ?? "")
    // plain navigation on purpose: api.ts is not a React module and must also drop in-memory state
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login?next=" + encodeURIComponent(here))
  }
}

function parse<T>(status: number, data: { error?: string; field?: unknown } | null): T {
  if (status < 200 || status >= 300) throw new ApiError(data?.error ?? `เกิดข้อผิดพลาด (${status})`, status, typeof data?.field === "string" ? data.field : undefined)
  return data as T
}

async function json<T>(res: Response): Promise<T> {
  return parse<T>(res.status, await res.json().catch(() => null))
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers["Content-Type"] = "application/json"
  return json<T>(
    await send(path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
  )
}

/**
 * multipart upload: no Content-Type header, the browser sets the boundary.
 * With onProgress it uses XMLHttpRequest, because fetch cannot report upload progress.
 */
export async function apiUpload<T>(path: string, formData: FormData, onProgress?: (percent: number) => void): Promise<T> {
  if (!onProgress) return json<T>(await send(path, { method: "POST", body: formData }))
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", BASE + path)
    const tok = getToken()
    if (tok) xhr.setRequestHeader("Authorization", `Bearer ${tok}`)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onerror = () => reject(new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", 0))
    xhr.onload = () => {
      if (xhr.status === 401) onUnauthorized()
      let data = null
      try { data = JSON.parse(xhr.responseText) } catch { /* non-JSON body */ }
      try { resolve(parse<T>(xhr.status, data)) } catch (e) { reject(e) }
    }
    xhr.send(formData)
  })
}

export async function fetchBlob(path: string): Promise<Blob> {
  const res = await send(path, {})
  if (!res.ok) throw new ApiError(`เกิดข้อผิดพลาด (${res.status})`, res.status)
  return res.blob()
}

/** open a stored document in a new tab (blob URL, revoked after 60 s) */
export async function openDocument(id: number, filename: string): Promise<void> {
  // open the tab synchronously (inside the click) so popup blockers allow it, then point it at the blob
  const w = window.open("", "_blank")
  let url: string
  try {
    url = URL.createObjectURL(await fetchBlob(`/documents/${id}`))
  } catch (e) {
    w?.close()
    throw e
  }
  if (w) {
    w.location.href = url
  } else {
    // popup blocked: fall back to a download
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const KEY = "user"
const TOKEN_KEY = "token"

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

// storage event only fires cross-tab; fire it ourselves for this tab
function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("storage"))
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb)
  return () => window.removeEventListener("storage", cb)
}

/** drop apply drafts; `keepUserId` keeps that user's own (drafts are keyed apply-draft-<userId>-<jobId>) */
function clearDrafts(keepUserId?: number) {
  const keep = keepUserId == null ? null : `apply-draft-${keepUserId}-`
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (k?.startsWith("apply-draft-") && !(keep && k.startsWith(keep))) localStorage.removeItem(k)
  }
}

export function setSession(token: string, user: User) {
  try {
    clearDrafts(user.user_id) // another user's drafts must not survive a login
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(KEY, JSON.stringify(user))
  } catch {
    // storage blocked: user stays logged out
  }
  notify()
}

function clearSession() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // nothing stored
  }
  notify()
}

export function logout() {
  clearSession()
  try {
    clearDrafts()
  } catch {
    // nothing stored
  }
}

/** undefined = not read yet (server render), null = not logged in */
export function useUser(): User | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, read, () => undefined)
  return useMemo(() => {
    if (raw === undefined) return undefined
    try {
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  }, [raw])
}
