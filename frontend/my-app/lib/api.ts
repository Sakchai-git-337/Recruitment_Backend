import { useMemo, useSyncExternalStore } from "react"
import type { User } from "./types.ts"

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function token(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
  const tok = token()
  if (tok) headers.Authorization = `Bearer ${tok}`
  let res: Response
  try {
    res = await fetch(BASE + path, { ...init, headers })
  } catch {
    throw new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", 0)
  }
  if (res.status === 401) {
    logout()
    if (typeof window !== "undefined" && window.location?.pathname && !window.location.pathname.startsWith("/login")) {
      // plain navigation on purpose: api.ts is not a React module and must also drop in-memory state
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login")
    }
  }
  return res
}

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(data?.error ?? `เกิดข้อผิดพลาด (${res.status})`, res.status)
  return data as T
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

/** multipart upload: no Content-Type header, the browser sets the boundary */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return json<T>(await send(path, { method: "POST", body: formData }))
}

export async function fetchBlob(path: string): Promise<Blob> {
  const res = await send(path, {})
  if (!res.ok) throw new ApiError(`เกิดข้อผิดพลาด (${res.status})`, res.status)
  return res.blob()
}

/** open a stored document in a new tab (blob URL, revoked after 60 s) */
export async function openDocument(id: number, filename: string): Promise<void> {
  const blob = await fetchBlob(`/documents/${id}`)
  const url = URL.createObjectURL(blob)
  const w = window.open(url, "_blank")
  if (!w) {
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

export function setSession(token: string, user: User) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(KEY, JSON.stringify(user))
  } catch {
    // storage blocked: user stays logged out
  }
  notify()
}

export function logout() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(TOKEN_KEY)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith("apply-draft-")) localStorage.removeItem(k)
    }
  } catch {
    // nothing stored
  }
  notify()
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
