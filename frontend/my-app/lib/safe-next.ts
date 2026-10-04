/** `?next=` must be a same-site path: no protocol-relative, backslash or control characters */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !/[\x00-\x1f\\]/.test(next) ? next : null
}
