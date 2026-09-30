"use client"

import { useQuery } from "@tanstack/react-query"
import { Download, Loader2 } from "lucide-react"
import { useState } from "react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { ErrorState, TableSkeleton } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { downloadFile } from "@/lib/download"
import { kg, rupees } from "@/lib/format"
import type { DailyProductionReport, MonthlySalesReport, ProcessFigures, WasteReport } from "@/types/api"

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
export const today = () => iso(new Date())
export const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000))
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString("en-GB", { month: "long" }))

export function ExportButton({ path, params, label = "Export Excel" }: { path: string; params: Record<string, string | number | undefined>; label?: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button variant="outline" disabled={busy} onClick={async () => {
      setBusy(true)
      try {
        toast.success(`Downloaded ${await downloadFile(path, params)}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Export failed.")
      } finally {
        setBusy(false)
      }
    }}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {label}
    </Button>
  )
}

function Toolbar({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {actions}
    </div>
  )
}

function DateInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" className="h-9 w-[160px]" value={value} max={today()} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function ProcessCard({ title, figures }: { title: string; figures: ProcessFigures }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Sessions" value={figures.sessions} />
        <StatCard label="Input" value={kg(figures.input_kg)} />
        <StatCard label="Output" value={kg(figures.output_kg)} />
        <StatCard label="Efficiency" value={`${figures.efficiency_pct}%`} hint={`Waste ${kg(figures.waste_kg)}`} />
      </CardContent>
    </Card>
  )
}

// ─── Daily production ───────────────────────────────────────────────────────

export function DailyProduction() {
  const [day, setDay] = useState(today())
  const report = useQuery<DailyProductionReport>({
    queryKey: ["reports/daily-production", day],
    queryFn: () => api("reports/daily-production", { params: { date: day } }),
    enabled: !!day,
  })
  return (
    <div>
      <Toolbar actions={<ExportButton path="reports/daily-production/export" params={{ date: day }} />}>
        <DateInput id="daily-date" label="Date" value={day} onChange={setDay} />
      </Toolbar>
      {report.isError ? <ErrorState message={report.error.message} onRetry={() => report.refetch()} />
        : report.isPending ? <TableSkeleton rows={3} columns={4} />
        : (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Warehouse</CardTitle><CardDescription>Deliveries received that day</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <StatCard label="Stock entries" value={report.data.warehouse.stock_entries} />
                <StatCard label="Total weight" value={kg(report.data.warehouse.total_weight_kg)} />
              </CardContent>
            </Card>
            <ProcessCard title="Sorting" figures={report.data.sorting} />
            <ProcessCard title="Decolorization" figures={report.data.decolorization} />
          </div>
        )}
    </div>
  )
}

// ─── Monthly sales ──────────────────────────────────────────────────────────

export function MonthlySales() {
  const now = new Date()
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const report = useQuery<MonthlySalesReport>({
    queryKey: ["reports/monthly-sales", year, month],
    queryFn: () => api("reports/monthly-sales", { params: { year, month } }),
  })
  const methods = report.data ? Object.entries(report.data.payment_method_breakdown) : []
  const totalPaid = methods.reduce((a, [, v]) => a + v.amount, 0) || 1

  return (
    <div>
      <Toolbar actions={<ExportButton path="reports/monthly-sales/export" params={{ year, month }} />}>
        <div className="grid gap-1.5">
          <Label htmlFor="report-month">Month</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger id="report-month" className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-year">Year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger id="report-year" className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i)).map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Toolbar>
      {report.isError ? <ErrorState message={report.error.message} onRetry={() => report.refetch()} />
        : report.isPending ? <TableSkeleton rows={3} columns={4} />
        : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Orders" value={report.data.total_orders} hint={`${report.data.total_dispatches} dispatches`} />
              <StatCard label="Revenue" value={rupees(report.data.total_revenue)} hint={`${kg(report.data.total_weight_kg)} sold`} />
              <StatCard label="Collected" value={rupees(report.data.total_collected)} />
              <StatCard label="Outstanding" value={rupees(report.data.pending_amount)} hint={`Avg ${rupees(report.data.avg_price_per_kg)}/kg`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Orders by status</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  {Object.entries(report.data.status_breakdown).length
                    ? Object.entries(report.data.status_breakdown).map(([status, count]) => (
                      <div key={status} className="rounded-lg bg-muted/50 px-4 py-3 text-center">
                        <p className="text-xl font-semibold tabular-nums">{count}</p>
                        <StatusBadge status={status} />
                      </div>
                    ))
                    : <p className="text-sm text-muted-foreground">No orders this month.</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Payments by method</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {methods.length ? methods.map(([method, v]) => (
                    <div key={method}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{method} <span className="text-muted-foreground">({v.count})</span></span>
                        <span className="tabular-nums">{rupees(v.amount)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-chart-1" style={{ width: `${(v.amount / totalPaid) * 100}%` }} />
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No payments this month.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
    </div>
  )
}

// ─── Waste analysis ─────────────────────────────────────────────────────────

export function WasteAnalysis() {
  const [start, setStart] = useState(daysAgo(30))
  const [end, setEnd] = useState(today())
  const valid = !!start && !!end && start <= end
  const report = useQuery<WasteReport>({
    queryKey: ["reports/waste-analysis", start, end],
    queryFn: () => api("reports/waste-analysis", { params: { start, end } }),
    enabled: valid,
  })
  const chart = (report.data?.by_fabric ?? []).slice(0, 8).map((f) => ({ fabric: f.fabric, Waste: f.waste_kg, Output: f.output_kg }))

  return (
    <div>
      <Toolbar actions={<ExportButton path="reports/waste-analysis/export" params={{ start, end }} />}>
        <DateInput id="waste-start" label="From" value={start} onChange={setStart} />
        <DateInput id="waste-end" label="To" value={end} onChange={setEnd} />
      </Toolbar>
      {!valid ? <ErrorState message="Choose a start date on or before the end date." />
        : report.isError ? <ErrorState message={report.error.message} onRetry={() => report.refetch()} />
        : report.isPending ? <TableSkeleton rows={3} columns={4} />
        : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total input" value={kg(report.data.total.input_kg)} />
              <StatCard label="Total waste" value={kg(report.data.total.waste_kg)} />
              <StatCard label="Waste rate" value={`${report.data.total.waste_pct}%`} />
              <StatCard label="Sessions" value={(report.data.sorting.sessions ?? 0) + (report.data.decolorization.sessions ?? 0)}
                hint={`Sorting ${report.data.sorting.waste_pct}% · Decolorization ${report.data.decolorization.waste_pct}% waste`} />
            </div>
            {chart.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Waste by fabric</CardTitle>
                  <CardDescription>The {chart.length} fabrics with the most waste in this period</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tickLine={false} axisLine={false} fontSize={12}
                        tickFormatter={(v: number) => (v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(v))} />
                      <YAxis type="category" dataKey="fabric" tickLine={false} axisLine={false} fontSize={12} width={150} />
                      <Tooltip cursor={{ className: "fill-muted" }} formatter={(value) => kg(Number(value))}
                        contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Waste" stackId="a" isAnimationActive={false} fill="var(--chart-5)" />
                      <Bar dataKey="Output" stackId="a" isAnimationActive={false} fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader><CardTitle className="text-base">By fabric</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow><TableHead>Fabric</TableHead><TableHead>Input</TableHead><TableHead>Output</TableHead><TableHead>Waste</TableHead><TableHead>Waste %</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.data.by_fabric.length ? report.data.by_fabric.map((f) => (
                        <TableRow key={f.fabric}>
                          <TableCell className="font-medium">{f.fabric}</TableCell>
                          <TableCell className="tabular-nums">{kg(f.input_kg)}</TableCell>
                          <TableCell className="tabular-nums">{kg(f.output_kg)}</TableCell>
                          <TableCell className="tabular-nums">{kg(f.waste_kg)}</TableCell>
                          <TableCell className="tabular-nums">{f.waste_pct}%</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No sessions in this period.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  )
}
