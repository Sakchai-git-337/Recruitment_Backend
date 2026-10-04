# frontend/my-app/lib/api.ts

- ApiError · class · L6-L12 — class ApiError extends Error
- constructor · method · L8-L11 — constructor(message: string, status: number)
- token · function · L14-L20 — function token(): string | null
- api · function · L22-L41 — async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T>
- read · function · L46-L52 — function read(): string | null
- notify · function · L55-L57 — function notify()
- subscribe · function · L59-L62 — function subscribe(cb: () => void)
- setSession · function · L64-L72 — function setSession(token: string, user: User)
- logout · function · L74-L82 — function logout()
- useUser · function · L85-L95 — function useUser(): User | null | undefined
