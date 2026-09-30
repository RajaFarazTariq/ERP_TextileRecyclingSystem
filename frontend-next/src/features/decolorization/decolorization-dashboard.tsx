"use client"

import { AlertTriangle } from "lucide-react"

import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { kg } from "@/lib/format"
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

/** Stock-left bar used on the dashboard and in the chemicals table. */
export function ChemicalLevel({ chemical, compact }: { chemical: Chemical; compact?: boolean }) {
  const share = chemicalShareLeft(chemical)
  const low = isLowStock(chemical)
  return (
    <div className={cn("min-w-32", !compact && "space-y-1")}>
      {!compact && (
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">{chemical.chemical_name}</span>
          <span className={cn("tabular-nums text-xs", low ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {n(chemical.remaining_stock).toLocaleString()} / {n(chemical.total_stock).toLocaleString()} {chemical.unit_of_measure}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${chemical.chemical_name} stock left`}
          aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className={cn("h-full rounded-full", low ? "bg-destructive" : "bg-emerald-500")} style={{ width: `${Math.min(share, 1) * 100}%` }} />
        </div>
        {compact && <span className={cn("w-10 text-right text-xs tabular-nums", low && "font-semibold text-destructive")}>{Math.round(share * 100)}%</span>}
      </div>
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
  const output = completed.reduce((a, s) => a + n(s.output_quantity), 0)
  const issued = issuances.reduce((a, i) => a + n(i.quantity), 0)
  const low = chemicals.filter(isLowStock)

  return (
    <div className="space-y-4">
      {low.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>
            <span className="font-medium">Low chemical stock:</span> {low.map((c) => c.chemical_name).join(", ")} — below{" "}
            {LOW_STOCK_SHARE * 100}% remaining. Restock by raising the chemical&apos;s total stock.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tanks" value={tanks.length} hint={`${processing} processing · ${completedTanks} completed`} />
        <StatCard label="Tanks processing" value={`${tanks.length ? Math.round((processing / tanks.length) * 100) : 0}%`} hint="Share of tanks in use now" />
        <StatCard label="Output efficiency" value={`${input ? ((output / input) * 100).toFixed(1) : "0.0"}%`} hint={`${kg(output)} out of ${kg(input)} in`} />
        <StatCard label="Chemical issued" value={issued.toLocaleString()} hint={`${issuances.length} issuances`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tanks by status</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-5 gap-2 text-center">
            {TANK_STATUSES.map((status) => (
              <div key={status} className="rounded-lg bg-muted/50 p-3">
                <p className="text-2xl font-semibold tabular-nums">{tanks.filter((t) => t.tank_status === status).length}</p>
                <div className="mt-1"><StatusBadge status={status} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Total", sessions.length],
              ["Completed", completed.length],
              ["In progress", sessions.filter((s) => s.status === "In Progress").length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/50 p-3">
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chemical stock levels</CardTitle>
          <CardDescription>Red when less than {LOW_STOCK_SHARE * 100}% is left</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {chemicals.length ? chemicals.map((c) => <ChemicalLevel key={c.id} chemical={c} />)
            : <p className="text-sm text-muted-foreground">No chemicals recorded yet.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
