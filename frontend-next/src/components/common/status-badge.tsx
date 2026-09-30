import { cn } from "@/lib/utils"

// One colour language for statuses across every module
const TONES = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  danger: "bg-red-500/10 text-red-700 dark:text-red-300",
} as const

export type StatusTone = keyof typeof TONES

const STATUS_TONES: Record<string, StatusTone> = {
  Received: "info",
  Pending: "warning",
  Approved: "success",
  Rejected: "danger",
}

export function StatusBadge({ status, tone }: { status: string; tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone ?? STATUS_TONES[status] ?? "neutral"],
      )}
    >
      {status}
    </span>
  )
}
