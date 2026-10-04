/** date-only strings (YYYY-MM-DD) are parsed as local time, not UTC */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-"
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00" : iso)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}

export function formatMoney(n: number): string {
  return "฿" + n.toLocaleString("en-US")
}

export function formatSalaryRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min != null && max != null) return `${formatMoney(min)} – ${formatMoney(max)}`
  if (min != null) return `เริ่มต้น ${formatMoney(min)}`
  if (max != null) return `สูงสุด ${formatMoney(max)}`
  return "ไม่ระบุ"
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return Array.from(parts[0])[0].toUpperCase()
  return (Array.from(parts[0])[0] + Array.from(parts[parts.length - 1])[0]).toUpperCase()
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
