"use client"

import { useQuery } from "@tanstack/react-query"
import { Download, FileSpreadsheet, Loader2, Printer, Recycle, Scale, SlidersHorizontal, Trash2, TrendingUp, Wallet, HandCoins, ShoppingCart } from "lucide-react"
import { useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { axisProps, ChartCard, ChartLegend, ChartTooltip, cursorProps } from "@/components/common/chart"
import { Figure } from "@/components/common/figure"
import { FlowBar, Gauge, ProgressBar } from "@/components/common/meters"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { NavIcon } from "@/components/layout/nav-icon"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { downloadFile } from "@/lib/download"
import { compact, kg, plural, rupees } from "@/lib/format"
import { TONE, type StageTone } from "@/lib/tones"
import { cn } from "@/lib/utils"
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
      {busy ? <Loader2 className="size-4 animate-spin" /> : label.startsWith("Export Excel") ? <FileSpreadsheet className="size-4" /> : <Download className="size-4" />} {label}
    </Button>
  )
}

/** Filter panel above each report: the report's own inputs, then export and print. */
function Toolbar({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="surface mb-5 flex flex-wrap items-end justify-between gap-4 rounded-xl p-4">
      <div className="flex flex-wrap items-end gap-3">
        <span className="hidden size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex" aria-hidden>
          <SlidersHorizontal className="size-4" />
        </span>
        {children}
      </div>
      <div className="flex flex-wrap items-center gap-2" data-print="hide">
        <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
        {actions}
      </div>
    </div>
  )
}

function DateInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Input id={id} type="date" className="h-9 w-[160px]" value={value} max={today()} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/** A figure inside a card (no nested card). */
function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border bg-[color-mix(in_oklab,var(--card),var(--foreground)_1.5%)] p-3.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-xl font-bold tracking-tight"><Figure value={value} /></p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function StageTitle({ title, tone, icon, description }: { title: string; tone: StageTone; icon: "warehouse" | "sorting" | "decolorization"; description?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex size-9 items-center justify-center rounded-lg", TONE[tone].soft, TONE[tone].text)}>
        <NavIcon name={icon} className="size-4" />
      </span>
      <div>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
      </div>
    </div>
  )
}

function ProcessCard({ title, figures, tone, icon }: { title: string; figures: ProcessFigures; tone: StageTone; icon: "sorting" | "decolorization" }) {
  return (
    <Card className="animate-rise">
      <CardHeader><StageTitle title={title} tone={tone} icon={icon} description={plural(figures.sessions, "session")} /></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <Gauge value={figures.efficiency_pct} tone="success" label={`${title} efficiency`} />
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Sessions" value={figures.sessions} />
            <Metric label="Input" value={kg(figures.input_kg)} />
            <Metric label="Output" value={kg(figures.output_kg)} />
            <Metric label="Efficiency" value={`${figures.efficiency_pct}%`} hint={`Waste ${kg(figures.waste_kg)}`} />
          </div>
        </div>
        {figures.input_kg > 0 && (
          <FlowBar input={figures.input_kg} label={`${title} output and waste`} parts={[
            { value: figures.output_kg, tone: "success", label: "Output" },
            { value: figures.waste_kg, tone: "danger", label: "Waste" },
          ]} />
        )}
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
            <Card className="animate-rise">
              <CardHeader><StageTitle title="Warehouse" tone="warehouse" icon="warehouse" description="Deliveries received that day" /></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Metric label="Stock entries" value={report.data.warehouse.stock_entries} />
                <Metric label="Total weight" value={kg(report.data.warehouse.total_weight_kg)} />
              </CardContent>
            </Card>
            <div className="grid gap-4 xl:grid-cols-2">
              <ProcessCard title="Sorting" tone="sorting" icon="sorting" figures={report.data.sorting} />
              <ProcessCard title="Decolorization" tone="decolorization" icon="decolorization" figures={report.data.decolorization} />
            </div>
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
          <Label htmlFor="report-month" className="text-xs text-muted-foreground">Month</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger id="report-month" className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-year" className="text-xs text-muted-foreground">Year</Label>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Orders" icon={ShoppingCart} tone="sales" value={report.data.total_orders} hint={plural(report.data.total_dispatches, "dispatch", "dispatches")} />
              <StatCard label="Revenue" icon={TrendingUp} tone="brand" value={rupees(report.data.total_revenue)} hint={`${kg(report.data.total_weight_kg)} sold`} />
              <StatCard label="Collected" icon={Wallet} tone="success" value={rupees(report.data.total_collected)} />
              <StatCard label="Outstanding" icon={HandCoins} tone="warning" value={rupees(report.data.pending_amount)} hint={`Avg ${rupees(report.data.avg_price_per_kg)}/kg`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="animate-rise">
                <CardHeader><CardTitle>Orders by status</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Object.entries(report.data.status_breakdown).length
                    ? Object.entries(report.data.status_breakdown).map(([status, count]) => (
                      <div key={status} className="rounded-xl border px-4 py-3 text-center">
                        <p className="font-heading text-2xl font-bold">{count}</p>
                        <div className="mt-1"><StatusBadge status={status} /></div>
                      </div>
                    ))
                    : <p className="text-sm text-muted-foreground">No orders this month.</p>}
                </CardContent>
              </Card>
              <Card className="animate-rise">
                <CardHeader><CardTitle>Payments by method</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {methods.length ? methods.map(([method, v]) => (
                    <div key={method} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{method} <span className="font-normal text-muted-foreground">({v.count})</span></span>
                        <span className="font-semibold">{rupees(v.amount)}</span>
                      </div>
                      <ProgressBar value={(v.amount / totalPaid) * 100} tone="brand" label={`${method} share of payments`} />
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total input" icon={Scale} tone="sorting" value={kg(report.data.total.input_kg)} />
              <StatCard label="Total waste" icon={Trash2} tone="danger" value={kg(report.data.total.waste_kg)} />
              <StatCard label="Waste rate" icon={Recycle} tone="warning" value={`${report.data.total.waste_pct}%`} />
              <StatCard label="Sessions" icon={TrendingUp} tone="info" value={(report.data.sorting.sessions ?? 0) + (report.data.decolorization.sessions ?? 0)}
                hint={`Sorting ${report.data.sorting.waste_pct}% · Decolorization ${report.data.decolorization.waste_pct}% waste`} />
            </div>
            {chart.length > 0 && (
              <ChartCard title="Waste by fabric" description={`The ${chart.length} fabrics with the most waste in this period`} contentClassName="h-80"
                actions={<ChartLegend items={[{ label: "Waste", color: "var(--chart-5)" }, { label: "Output", color: "var(--chart-1)" }]} />}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 16 }} barSize={18}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 4" stroke="var(--border)" />
                    <XAxis type="number" {...axisProps} tickFormatter={(v: number) => compact(v)} />
                    <YAxis type="category" dataKey="fabric" {...axisProps} width={180} />
                    <Tooltip cursor={cursorProps} content={<ChartTooltip format={(v) => kg(v)} />} />
                    <Bar dataKey="Waste" stackId="a" isAnimationActive={false} fill="var(--chart-5)" radius={[4, 0, 0, 4]} />
                    <Bar dataKey="Output" stackId="a" isAnimationActive={false} fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            <Card className="animate-rise gap-0 pb-0">
              <CardHeader className="pb-4"><CardTitle>By fabric</CardTitle></CardHeader>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Fabric</TableHead><TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead><TableHead className="text-right">Waste</TableHead>
                    <TableHead className="pr-5">Waste %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.data.by_fabric.length ? report.data.by_fabric.map((f) => (
                    <TableRow key={f.fabric}>
                      <TableCell className="h-12 pl-5 font-medium">{f.fabric}</TableCell>
                      <TableCell className="text-right">{kg(f.input_kg)}</TableCell>
                      <TableCell className="text-right">{kg(f.output_kg)}</TableCell>
                      <TableCell className="text-right">{kg(f.waste_kg)}</TableCell>
                      <TableCell className="pr-5">
                        <div className="flex min-w-36 items-center gap-2.5">
                          <ProgressBar value={f.waste_pct} size="sm" tone={f.waste_pct >= 10 ? "danger" : "warning"} label={`${f.fabric} waste share`} />
                          <span className="w-12 text-right text-xs font-medium">{f.waste_pct}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No sessions in this period.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
    </div>
  )
}
