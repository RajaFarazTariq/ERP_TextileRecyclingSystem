"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Periods understood by the backend's date filter (apps/core/filters.py)
export type DateFilterValue =
  | { type: "all" }
  | { type: "today" | "this_week" | "this_month" | "this_year" }
  | { type: "year"; year?: string }
  | { type: "month"; month?: string }
  | { type: "custom"; start?: string; end?: string }

const OPTIONS: { value: DateFilterValue["type"]; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "this_year", label: "This year" },
  { value: "year", label: "By year" },
  { value: "month", label: "By month" },
  { value: "custom", label: "Custom range" },
]

/** Query parameters for the API, e.g. {date_filter: "this_week"} or {start, end}. */
export function dateParams(filter: DateFilterValue): Record<string, string | undefined> {
  switch (filter.type) {
    case "today":
    case "this_week":
    case "this_month":
    case "this_year":
      return { date_filter: filter.type }
    case "year":
      return { year: filter.year }
    case "month":
      return { month: filter.month }
    case "custom":
      return { start: filter.start, end: filter.end }
    default:
      return {}
  }
}

/**
 * Same periods applied in the browser, for lists whose API has no date
 * parameters. Weeks start on Monday, as in the backend.
 */
export function matchesDate(value: string | null | undefined, filter: DateFilterValue): boolean {
  if (filter.type === "all") return true
  if (!value) return false
  const d = new Date(value)
  const now = new Date()
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
  switch (filter.type) {
    case "today":
      return day(d).getTime() === day(now).getTime()
    case "this_week": {
      const start = day(now)
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
      return d >= start
    }
    case "this_month":
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    case "this_year":
      return d.getFullYear() === now.getFullYear()
    case "year":
      return !filter.year || String(d.getFullYear()) === filter.year
    case "month":
      return !filter.month || iso(d).slice(0, 7) === filter.month
    case "custom":
      return (!filter.start || iso(d) >= filter.start) && (!filter.end || iso(d) <= filter.end)
  }
}

export function DateFilter({ value, onChange }: { value: DateFilterValue; onChange: (v: DateFilterValue) => void }) {
  const thisYear = new Date().getFullYear()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value.type} onValueChange={(type) => onChange({ type } as DateFilterValue)}>
        <SelectTrigger className="h-9 w-[150px]" aria-label="Period"><SelectValue /></SelectTrigger>
        <SelectContent>
          {OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {value.type === "year" && (
        <Select value={value.year ?? ""} onValueChange={(year) => onChange({ type: "year", year })}>
          <SelectTrigger className="h-9 w-[110px]" aria-label="Year"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 6 }, (_, i) => String(thisYear - i)).map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {value.type === "month" && (
        <Input type="month" className="h-9 w-[160px]" aria-label="Month" value={value.month ?? ""}
          onChange={(e) => onChange({ type: "month", month: e.target.value })} />
      )}
      {value.type === "custom" && (
        <>
          <Input type="date" className="h-9 w-[150px]" aria-label="From" value={value.start ?? ""}
            onChange={(e) => onChange({ ...value, start: e.target.value })} />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" className="h-9 w-[150px]" aria-label="To" value={value.end ?? ""}
            onChange={(e) => onChange({ ...value, end: e.target.value })} />
        </>
      )}
    </div>
  )
}
