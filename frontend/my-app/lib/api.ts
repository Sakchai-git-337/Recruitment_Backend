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

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers["Content-Type"] = "application/json"
  const tok = token()
  if (tok) headers.Authorization = `Bearer ${tok}`
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } catch {
    throw new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", 0)
  }
  const data = await res.json().catch(() => null)
  if (res.status === 401) logout()
  if (!res.ok) throw new ApiError(data?.error ?? `เกิดข้อผิดพลาด (${res.status})`, res.status)
  return data as T
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
