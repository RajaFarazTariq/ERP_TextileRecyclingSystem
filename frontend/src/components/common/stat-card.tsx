import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { TONE, type Tone } from "@/lib/tones"
import { cn } from "@/lib/utils"
import { Figure, Sparkline } from "./figure"
import { Gauge } from "./meters"

/**
 * A key figure: label, big value (units shown smaller), and optional icon,
 * hint, change vs the previous period, sparkline and footer (e.g. a bar).
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  delta,
  spark,
  footer,
  muted,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  /** e.g. <Delta current={…} previous={…} /> */
  delta?: React.ReactNode
  spark?: number[]
  footer?: React.ReactNode
  /** Quiet styling for a zero/empty figure, so "0 kg" doesn't look broken */
  muted?: boolean
  className?: string
}) {
  return (
    <Card className={cn("animate-rise gap-0 py-4.5 transition-colors duration-150 hover:border-border-strong", className)}>
      <CardContent className="flex h-full flex-col px-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          {Icon && (
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONE[tone].soft, TONE[tone].text)}>
              <Icon className="size-4" aria-hidden />
            </span>
          )}
        </div>
        <p className={cn("mt-1 font-heading text-[28px] leading-tight font-bold tracking-tight", muted && "text-muted-foreground")}>
          <Figure value={value} />
        </p>
        {(delta || hint) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {delta}
            {hint && <span>{hint}</span>}
          </div>
        )}
        {spark && <Sparkline data={spark} className={cn("mt-3", TONE[tone].text)} />}
        {footer && <div className="mt-auto pt-3">{footer}</div>}
      </CardContent>
    </Card>
  )
}

/** A percentage shown as a radial gauge with a thin bar, e.g. "Output efficiency 82%". */
export function RateCard({
  label,
  percent,
  hint,
  tone = "brand",
}: {
  label: string
  percent: number
  hint?: string
  tone?: Tone
}) {
  const value = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0
  return (
    <Card className="animate-rise gap-0 py-4.5">
      <CardContent className="flex items-center gap-4 px-5">
        <Gauge value={value} tone={tone} label={label} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 font-heading text-2xl font-bold tracking-tight">
            <Figure value={`${value.toFixed(1)}%`} />
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
