/** date-only strings (YYYY-MM-DD) are parsed as local time, not UTC */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-"
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00" : iso)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}

/** how long ago a job was posted: "< 1 ชม.ที่แล้ว", "5 ชม.ที่แล้ว", "3 วันที่แล้ว", older than 30 days → date */
export function timeAgo(iso: string | null | undefined, now = new Date()): string {
  const t = iso ? new Date(iso).getTime() : NaN
  if (isNaN(t)) return "-"
  const hours = Math.floor((now.getTime() - t) / 3_600_000)
  if (hours < 1) return "< 1 ชม.ที่แล้ว"
  if (hours < 24) return `${hours} ชม.ที่แล้ว`
  const days = Math.floor(hours / 24)
  return days <= 30 ? `${days} วันที่แล้ว` : formatDate(iso)
}

export function formatMoney(n: number): string {
  return "฿" + n.toLocaleString("en-US")
}

export function formatSalaryRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min != null && max != null) return `${formatMoney(min)} – ${formatMoney(max)}`
  if (min != null) return `เริ่มต้น ${formatMoney(min)}`
  if (max != null) return `สูงสุด ${formatMoney(max)}`
  return "เงินเดือนตามตกลง"
}

/** first letter of a word, skipping Thai leading vowels (เ แ โ ใ ไ) that are not a sound on their own */
const first = (w: string) => Array.from(w.replace(/^[เแโใไ]+(?=.)/, ""))[0].toUpperCase()

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return first(parts[0])
  return first(parts[0]) + first(parts[parts.length - 1])
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
