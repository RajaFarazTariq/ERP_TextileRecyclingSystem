import { TONE, type StatusTone } from "@/lib/tones"
import { cn } from "@/lib/utils"

export type { StatusTone }

// One colour language for statuses across every module
const STATUS_TONES: Record<string, StatusTone> = {
  // warehouse
  Received: "info",
  Pending: "warning",
  Approved: "success",
  Rejected: "danger",
  // sessions
  "In Progress": "running",
  Completed: "success",
  "On Hold": "warning",
  Failed: "danger",
  // tanks
  Empty: "neutral",
  Filled: "info",
  Processing: "running",
  Cleaning: "warning",
  // dryers
  Available: "success",
  Running: "running",
  Cooling: "info",
  Maintenance: "danger",
  // sales
  Draft: "neutral",
  Confirmed: "info",
  Dispatched: "running",
  Cancelled: "danger",
  Partial: "warning",
  Paid: "success",
  Loading: "warning",
  Delivered: "success",
  // quality
  Pass: "success",
  Conditional: "warning",
  Fail: "danger",
  Quarantined: "danger",
  Released: "info",
  Open: "warning",
  Done: "success",
  // fabric lots
  "In Warehouse": "neutral",
  "In Sorting": "running",
  Sorted: "success",
  "Sent to Decolorization": "info",
}

export function statusTone(status: string): StatusTone {
  return STATUS_TONES[status] ?? "neutral"
}

export function StatusBadge({ status, tone }: { status: string; tone?: StatusTone }) {
  const t = tone ?? statusTone(status)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[t].soft,
        TONE[t].text,
        TONE[t].border,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", TONE[t].solid, t === "running" && `animate-pulse-dot ${TONE[t].text}`)}
      />
      {status}
    </span>
  )
}
