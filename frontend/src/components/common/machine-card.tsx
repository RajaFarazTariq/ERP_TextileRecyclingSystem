"use client"

import { Timer, type LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { elapsed, kg } from "@/lib/format"
import { TONE, type Tone } from "@/lib/tones"
import { cn } from "@/lib/utils"
import { ProgressBar } from "./meters"
import { StatusBadge, statusTone } from "./status-badge"

/**
 * A dryer, tank or other machine: name, type and capacity, status, how full it
 * is, and how long it has been running. Machines under maintenance are hatched.
 */
export function MachineCard({
  name,
  subtitle,
  status,
  icon: Icon,
  tone = "brand",
  load,
  capacity,
  loadLabel,
  runningSince,
  detail,
  actions,
}: {
  name: string
  subtitle?: React.ReactNode
  status: string
  icon?: LucideIcon
  tone?: Tone
  /** Current load in kg (omit when not tracked) */
  load?: number
  capacity: number
  /** Accessible name for the load bar, e.g. "Tank 1 fill level" */
  loadLabel: string
  /** Start time of the running batch, shown as elapsed time */
  runningSince?: string | null
  detail?: React.ReactNode
  actions?: React.ReactNode
}) {
  const t = statusTone(status)
  const ratio = load !== undefined && capacity > 0 ? load / capacity : 0
  const over = ratio > 1
  const maintenance = t === "danger"
  return (
    <Card className={cn("animate-rise gap-0 py-4 transition-colors duration-150 hover:border-border-strong", maintenance && "hatched")}>
      <CardContent className="space-y-3.5 px-4.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE[tone].soft, TONE[tone].text)}>
                <Icon className="size-4.5" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-heading font-semibold">{name}</p>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <StatusBadge status={status} />
            {actions}
          </div>
        </div>

        {load !== undefined && (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">
                <span className="font-medium text-foreground">{kg(load)}</span> of {kg(capacity)}
              </span>
              <span className={cn("shrink-0 whitespace-nowrap", over ? "font-semibold text-danger-fg" : "font-medium text-muted-foreground")}>
                {over ? `Over capacity · ${Math.round(ratio * 100)}%` : `${Math.round(ratio * 100)}%`}
              </span>
            </div>
            <ProgressBar value={Math.min(ratio, 1) * 100} tone={over ? "danger" : t === "running" ? "running" : tone} label={loadLabel} />
          </div>
        )}

        {(runningSince || detail) && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            {detail && <span className="min-w-0 truncate">{detail}</span>}
            {runningSince && t === "running" && (
              <span className="inline-flex items-center gap-1 font-medium text-running-fg">
                <Timer className="size-3.5" aria-hidden /> {elapsed(runningSince)}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
