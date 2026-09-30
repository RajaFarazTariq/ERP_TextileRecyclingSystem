"use client"

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { EmptyState } from "@/components/common/states"
import { RateCard, StatCard } from "@/components/common/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { kg } from "@/lib/format"
import type { SortingSession } from "@/types/api"

const n = (v: string | number | null | undefined) => Number(v) || 0

/** Figures shown on the Sorting dashboard, computed from the sessions list. */
export function sortingKpis(sessions: SortingSession[]) {
  const completed = sessions.filter((s) => s.status === "Completed")
  const input = sessions.reduce((a, s) => a + n(s.quantity_taken), 0)
  const sorted = sessions.reduce((a, s) => a + n(s.quantity_sorted), 0)
  const waste = sessions.reduce((a, s) => a + n(s.waste_quantity), 0)
  const efficiency = (s: SortingSession) => (n(s.quantity_taken) > 0 ? (n(s.quantity_sorted) / n(s.quantity_taken)) * 100 : 0)
  const best = completed.reduce<SortingSession | null>((b, s) => (!b || efficiency(s) > efficiency(b) ? s : b), null)
  return {
    total: sessions.length,
    completed: completed.length,
    input,
    sorted,
    waste,
    efficiencyPct: input > 0 ? (sorted / input) * 100 : 0,
    wastePct: input > 0 ? (waste / input) * 100 : 0,
    completionPct: sessions.length > 0 ? (completed.length / sessions.length) * 100 : 0,
    best: best ? { session: best, efficiency: efficiency(best) } : null,
  }
}

export function SortingDashboard({ sessions }: { sessions: SortingSession[] }) {
  if (!sessions.length) {
    return <EmptyState title="No sorting sessions yet" description="Start a session to see efficiency and waste figures here." />
  }
  const k = sortingKpis(sessions)
  const recent = [...sessions]
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
    .slice(0, 8)
    .reverse()
    .map((s) => ({
      name: `#${s.id}`,
      material: s.fabric_material,
      Input: n(s.quantity_taken),
      Sorted: n(s.quantity_sorted),
      Waste: n(s.waste_quantity),
    }))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <RateCard label="Output efficiency" percent={k.efficiencyPct} tone="success" hint="Sorted ÷ input, all sessions" />
        <RateCard label="Waste rate" percent={k.wastePct} tone="warning" hint="Waste ÷ input, all sessions" />
        <RateCard label="Sessions completed" percent={k.completionPct} hint={`${k.completed} of ${k.total}`} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total input" value={kg(k.input)} hint="Fabric taken for sorting" />
        <StatCard label="Total sorted" value={kg(k.sorted)} />
        <StatCard label="Total waste" value={kg(k.waste)} />
        <StatCard
          label="Best session"
          value={k.best ? `${k.best.efficiency.toFixed(1)}%` : "—"}
          hint={k.best ? `#${k.best.session.id} ${k.best.session.fabric_material}` : "No completed sessions"}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent sessions</CardTitle>
          <CardDescription>Input, sorted output and waste for the last {recent.length} sessions</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={recent} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={56}
                tickFormatter={(v: number) => (v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(v))} />
              <Tooltip
                cursor={{ className: "fill-muted" }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
                formatter={(value) => kg(Number(value))}
                labelFormatter={(label, payload) => `${label} ${payload?.[0]?.payload?.material ?? ""}`}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Input" isAnimationActive={false} fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Sorted" isAnimationActive={false} fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Waste" isAnimationActive={false} fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
