// Display formatting shared by all pages.

const number = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 })
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })

export function kg(value: string | number | null | undefined): string {
  const n = Number(value)
  return Number.isFinite(n) ? `${number.format(n)} kg` : "—"
}

export function rupees(value: string | number | null | undefined): string {
  const n = Number(value)
  return Number.isFinite(n) ? `Rs. ${number.format(Math.round(n))}` : "—"
}

export function date(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d)
}

const compactFmt = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 1 })

/** Short axis/label form: 3,200,000 → "3.2M", 18,400 → "18.4k". */
export function compact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${compactFmt.format(value / 1_000_000)}M`
  if (abs >= 1000) return `${compactFmt.format(value / 1000)}k`
  return compactFmt.format(value)
}

/** "1 dryer", "3 dryers"; pass `many` for irregular plurals. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en-PK")} ${count === 1 ? one : many}`
}

export function percent(value: number, digits = 1): string {
  return Number.isFinite(value) ? `${value.toFixed(digits)}%` : "—"
}

/** "Malik Enterprises" → "ME", "admin" → "AD". */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean)
  if (!words.length) return "?"
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase()
}

const relativeFmt = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" })

/** "just now", "5 minutes ago", "yesterday"; older than a week shows the date. */
export function relativeTime(value: string | number | Date | null | undefined, now = Date.now()): string {
  if (!value) return "—"
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return "—"
  const seconds = Math.round((t - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return "just now"
  if (abs < 3600) return relativeFmt.format(Math.round(seconds / 60), "minute")
  if (abs < 86_400) return relativeFmt.format(Math.round(seconds / 3600), "hour")
  if (abs < 7 * 86_400) return relativeFmt.format(Math.round(seconds / 86_400), "day")
  return date(new Date(t).toISOString())
}

/** Elapsed time since `start`, e.g. "2h 15m". */
export function elapsed(start: string | null | undefined, now = Date.now()): string {
  if (!start) return "—"
  const minutes = Math.max(0, Math.floor((now - new Date(start).getTime()) / 60_000))
  if (!Number.isFinite(minutes)) return "—"
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${mins}m` : `${mins}m`
}
