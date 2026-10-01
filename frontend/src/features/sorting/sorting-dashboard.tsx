"use client"

import { Award, PackageCheck, Scale, Trash2 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { axisProps, ChartCard, ChartLegend, ChartTooltip, cursorProps, gridProps, yAxisProps } from "@/components/common/chart"
import { FlowBar } from "@/components/common/meters"
import { SectionTitle } from "@/components/common/section-title"
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
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionTitle>Throughput</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total input" icon={Scale} tone="sorting" value={kg(k.input)} hint="Fabric taken for sorting" />
          <StatCard label="Total sorted" icon={PackageCheck} tone="success" value={kg(k.sorted)} hint="Ready for decolorization" />
          <StatCard label="Total waste" icon={Trash2} tone="danger" value={kg(k.waste)} hint="Rejected while sorting" />
          <StatCard
            label="Best session"
            icon={Award}
            tone="warning"
            value={k.best ? `${k.best.efficiency.toFixed(1)}%` : "—"}
            hint={k.best ? `#${k.best.session.id} ${k.best.session.fabric_material}` : "No completed sessions"}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Output</SectionTitle>
        <div className="grid gap-4 md:grid-cols-3">
          <RateCard label="Output efficiency" percent={k.efficiencyPct} tone="success" hint="Sorted ÷ input, all sessions" />
          <RateCard label="Waste rate" percent={k.wastePct} tone="danger" hint="Waste ÷ input, all sessions" />
          <RateCard label="Sessions completed" percent={k.completionPct} tone="sorting" hint={`${k.completed} of ${k.total}`} />
        </div>
        <Card className="animate-rise">
          <CardHeader>
            <CardTitle>Where the fabric went</CardTitle>
            <CardDescription className="mt-0.5">Share of {kg(k.input)} taken for sorting</CardDescription>
          </CardHeader>
          <CardContent>
            <FlowBar input={k.input} label="Sorted, waste and remaining share of the input" parts={[
              { value: k.sorted, tone: "success", label: "Sorted" },
              { value: k.waste, tone: "danger", label: "Waste" },
            ]} />
          </CardContent>
        </Card>
      </section>

      <ChartCard title="Recent sessions" description={`Input, sorted output and waste for the last ${recent.length} sessions`} contentClassName="h-72"
        actions={<ChartLegend items={[
          { label: "Input", color: "var(--stage-sorting)" },
          { label: "Sorted", color: "var(--chart-1)" },
          { label: "Waste", color: "var(--chart-5)" },
        ]} />}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={recent} margin={{ left: 0, right: 8, top: 8 }} barGap={3}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip cursor={cursorProps}
              content={<ChartTooltip format={(v) => kg(v)} title={(label, p) => `Session ${label} · ${String(p.material ?? "")}`} />} />
            <Bar dataKey="Input" isAnimationActive={false} fill="var(--stage-sorting)" radius={[4, 4, 1, 1]} maxBarSize={22} />
            <Bar dataKey="Sorted" isAnimationActive={false} fill="var(--chart-1)" radius={[4, 4, 1, 1]} maxBarSize={22} />
            <Bar dataKey="Waste" isAnimationActive={false} fill="var(--chart-5)" radius={[4, 4, 1, 1]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
