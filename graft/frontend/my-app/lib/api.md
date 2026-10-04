# frontend/my-app/lib/api.ts

- ApiError · class · L6-L12 — class ApiError extends Error
- constructor · method · L8-L11 — constructor(message: string, status: number)
- api · function · L14-L28 — async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T>
- read · function · L32-L38 — function read(): string | null
- notify · function · L41-L43 — function notify()
- subscribe · function · L45-L48 — function subscribe(cb: () => void)
- setUser · function · L50-L57 — function setUser(user: User)
- logout · function · L59-L66 — function logout()
- useUser · function · L69-L79 — function useUser(): User | null | undefined
