"use client"

import { AlertTriangle, Beaker, Cylinder, Gauge as GaugeIcon, Layers } from "lucide-react"

import { FlowBar, ProgressBar, SegmentedBar } from "@/components/common/meters"
import { SectionTitle } from "@/components/common/section-title"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge, statusTone } from "@/components/common/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { kg } from "@/lib/format"
import { TONE } from "@/lib/tones"
import { cn } from "@/lib/utils"
import type { Chemical, ChemicalIssuance, DecolorizationSession, Tank } from "@/types/api"
import { LOW_STOCK_SHARE, TANK_STATUSES } from "./schemas"

const n = (v: string | number | null | undefined) => Number(v) || 0

export function chemicalShareLeft(c: Chemical) {
  return n(c.total_stock) > 0 ? n(c.remaining_stock) / n(c.total_stock) : 0
}

export function isLowStock(c: Chemical) {
  return n(c.total_stock) > 0 && chemicalShareLeft(c) < LOW_STOCK_SHARE
}

/** Stock-left bar with the reorder level marked; used on the dashboard and in the chemicals table. */
export function ChemicalLevel({ chemical, compact }: { chemical: Chemical; compact?: boolean }) {
  const share = chemicalShareLeft(chemical)
  const low = isLowStock(chemical)
  const bar = (
    <ProgressBar value={Math.min(share, 1) * 100} threshold={LOW_STOCK_SHARE * 100} tone={low ? "danger" : "decolorization"}
      label={`${chemical.chemical_name} stock left`} size={compact ? "sm" : "md"} />
  )
  if (compact) {
    return (
      <div className="flex min-w-36 items-center gap-2.5">
        {bar}
        <span className={cn("w-10 text-right text-xs", low ? "font-semibold text-danger-fg" : "text-muted-foreground")}>{Math.round(share * 100)}%</span>
      </div>
    )
  }
  return (
    <div className="space-y-2 rounded-lg border bg-[color-mix(in_oklab,var(--card),var(--foreground)_1.5%)] p-3.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          {low && <AlertTriangle className="size-3.5 text-danger-fg" aria-hidden />}
          {chemical.chemical_name}
        </span>
        <span className={cn("text-xs", low ? "font-semibold text-danger-fg" : "text-muted-foreground")}>
          {n(chemical.remaining_stock).toLocaleString()} / {n(chemical.total_stock).toLocaleString()} {chemical.unit_of_measure}
        </span>
      </div>
      {bar}
      <p className="text-[11px] text-faint">{Math.round(share * 100)}% left · reorder below {LOW_STOCK_SHARE * 100}%</p>
    </div>
  )
}

export function DecolorizationDashboard({
  tanks, chemicals, issuances, sessions,
}: {
  tanks: Tank[]
  chemicals: Chemical[]
  issuances: ChemicalIssuance[]
  sessions: DecolorizationSession[]
}) {
  const processing = tanks.filter((t) => t.tank_status === "Processing").length
  const completedTanks = tanks.filter((t) => t.tank_status === "Completed").length
  const completed = sessions.filter((s) => s.status === "Completed")
  const input = sessions.reduce((a, s) => a + n(s.input_quantity), 0)
  const completedInput = completed.reduce((a, s) => a + n(s.input_quantity), 0)
  const output = completed.reduce((a, s) => a + n(s.output_quantity), 0)
  const waste = completed.reduce((a, s) => a + n(s.waste_quantity), 0)
  const issued = issuances.reduce((a, i) => a + n(i.quantity), 0)
  const low = chemicals.filter(isLowStock)
  const running = sessions.filter((s) => s.status === "In Progress").length

  return (
    <div className="space-y-6">
      {low.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/8 p-4 text-sm">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning-fg">
            <AlertTriangle className="size-4" aria-hidden />
          </span>
          <p className="pt-1">
            <span className="font-semibold">Low chemical stock:</span> {low.map((c) => c.chemical_name).join(", ")} — below{" "}
            {LOW_STOCK_SHARE * 100}% remaining. Restock by raising the chemical&apos;s total stock.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <SectionTitle>Throughput</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tanks" icon={Cylinder} tone="decolorization" value={tanks.length} hint={`${processing} processing · ${completedTanks} completed`} />
          <StatCard label="Tanks processing" icon={GaugeIcon} tone="running" value={`${tanks.length ? Math.round((processing / tanks.length) * 100) : 0}%`} hint="Share of tanks in use now" />
          <StatCard label="Output efficiency" icon={Layers} tone="success" value={`${input ? ((output / input) * 100).toFixed(1) : "0.0"}%`} hint={`${kg(output)} out of ${kg(input)} in`} />
          <StatCard label="Chemical issued" icon={Beaker} tone="warning" value={issued.toLocaleString()} hint={`${issuances.length} issuances`} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="animate-rise lg:col-span-3">
          <CardHeader>
            <CardTitle>Tanks by status</CardTitle>
            <CardDescription className="mt-0.5">{tanks.length} tanks in total</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {TANK_STATUSES.map((status) => {
              const count = tanks.filter((t) => t.tank_status === status).length
              const tone = TONE[statusTone(status)]
              return (
                <div key={status} className={cn("rounded-xl border p-3 text-center", count ? tone.border : "border-border")}>
                  <p className={cn("font-heading text-2xl font-bold", !count && "text-faint")}>{count}</p>
                  <div className="mt-1.5"><StatusBadge status={status} /></div>
                </div>
              )
            })}
            <SegmentedBar className="col-span-full mt-2" label="Tanks by status"
              segments={TANK_STATUSES.map((status) => ({
                value: tanks.filter((t) => t.tank_status === status).length,
                tone: statusTone(status),
                label: `${status} ${tanks.length ? Math.round((tanks.filter((t) => t.tank_status === status).length / tanks.length) * 100) : 0}%`,
              }))} />
          </CardContent>
        </Card>
        <Card className="animate-rise lg:col-span-2">
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <CardDescription className="mt-0.5">{running} running now</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5 text-center">
              {([
                ["Total", sessions.length],
                ["Completed", completed.length],
                ["In progress", running],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-xl border p-3">
                  <p className="font-heading text-2xl font-bold">{value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <FlowBar input={completedInput} label="Output and waste share of completed input" parts={[
              { value: output, tone: "success", label: "Output" },
              { value: waste, tone: "danger", label: "Waste" },
            ]} />
            <p className="text-xs text-faint">Completed sessions · {kg(input)} put in across all sessions</p>
          </CardContent>
        </Card>
      </div>

      <Card className="animate-rise">
        <CardHeader>
          <CardTitle>Chemical stock levels</CardTitle>
          <CardDescription className="mt-0.5">The mark on each bar is the {LOW_STOCK_SHARE * 100}% reorder level</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {chemicals.length ? chemicals.map((c) => <ChemicalLevel key={c.id} chemical={c} />)
            : <p className="text-sm text-muted-foreground">No chemicals recorded yet.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
