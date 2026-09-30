import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="px-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

/** A percentage with a thin bar, e.g. "Output efficiency 82%". */
export function RateCard({
  label,
  percent,
  hint,
  tone = "primary",
}: {
  label: string
  percent: number
  hint?: string
  tone?: "primary" | "success" | "warning"
}) {
  const value = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0
  const bar = { primary: "bg-primary", success: "bg-emerald-500", warning: "bg-amber-500" }[tone]
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value.toFixed(1)}%</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <div className={cn("h-full rounded-full", bar)} style={{ width: `${value}%` }} />
        </div>
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
