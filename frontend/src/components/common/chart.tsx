"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { compact } from "@/lib/format"
import { cn } from "@/lib/utils"

/** A card holding a chart: title, description, optional actions (period select, export). */
export function ChartCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName = "h-64",
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={cn("animate-rise", className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
        </div>
        {actions && <div className="flex items-center gap-2" data-print="hide">{actions}</div>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}

/** Vertical gradient for bar fills: `<ChartGradient id="rev" color="var(--chart-1)" />`, then fill="url(#rev)". */
export function ChartGradient({ id, color, from = 0.95, to = 0.45 }: { id: string; color: string; from?: number; to?: number }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={from} />
        <stop offset="100%" stopColor={color} stopOpacity={to} />
      </linearGradient>
    </defs>
  )
}

/** Shared axis and grid styling. Spread into <XAxis>/<YAxis>/<CartesianGrid>. */
export const axisProps = {
  tickLine: false,
  axisLine: false,
  fontSize: 12,
  stroke: "var(--faint)",
  tick: { fill: "var(--muted-foreground)" },
} as const

export const yAxisProps = { ...axisProps, width: 48, tickFormatter: (v: number) => compact(v) } as const

export const gridProps = { vertical: false, strokeDasharray: "3 4", stroke: "var(--border)" } as const

export const cursorProps = { fill: "var(--foreground)", fillOpacity: 0.04 } as const

interface TooltipPayload {
  name?: string | number
  value?: number | string
  color?: string
  fill?: string
  payload?: Record<string, unknown>
  dataKey?: string | number
}

/**
 * Tooltip body in the app's style. `format` turns a value into text (e.g.
 * rupees); `title` builds the heading from the label and the data point.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  format = (v) => String(v),
  title,
  footer,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string | number
  format?: (value: number, name: string) => string
  title?: (label: string, point: Record<string, unknown>) => string
  footer?: (point: Record<string, unknown>) => string | null
}) {
  if (!active || !payload?.length) return null
  const point = (payload[0].payload ?? {}) as Record<string, unknown>
  return (
    <div className="min-w-40 rounded-lg border border-border-strong bg-popover px-3 py-2 text-xs shadow-xl shadow-black/20">
      <p className="mb-1.5 font-medium text-foreground">{title ? title(String(label ?? ""), point) : label}</p>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
            <span className="size-2 rounded-sm" style={{ background: p.color ?? p.fill }} aria-hidden />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto pl-3 font-semibold text-foreground">{format(Number(p.value), String(p.name))}</span>
          </div>
        ))}
      </div>
      {footer && footer(point) && <p className="mt-1.5 border-t pt-1.5 text-muted-foreground">{footer(point)}</p>}
    </div>
  )
}

/** Small legend with coloured dots. */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.label}
        </span>
      ))}
    </div>
  )
}
