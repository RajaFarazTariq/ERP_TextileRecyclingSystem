"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { CalendarClock, Info, Printer } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { axisProps, ChartCard, ChartLegend, ChartTooltip, cursorProps, gridProps, yAxisProps } from "@/components/common/chart"
import { DateFilter, type DateFilterValue, dateParams } from "@/components/common/date-filter"
import { Figure } from "@/components/common/figure"
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { date, kg } from "@/lib/format"
import { cn } from "@/lib/utils"
import type {
  ReportCatalogue, ReportChart, ReportColumn, ReportColumnKind, ReportResult, ReportRow, ReportSchedules, ReportValue,
} from "@/types/reports"
import { ExportButton } from "./report-sections"

const COLORS = ["var(--chart-1)", "var(--chart-5)", "var(--chart-3)", "var(--chart-2)", "var(--chart-4)"]
const MAX_BARS = 12
const numberFmt = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 })
const NUMERIC: ReportColumnKind[] = ["number", "kg", "money", "percent"]

/** A value as text for its kind; rates per kg keep their decimals. */
function show(value: ReportValue | undefined, kind: ReportColumnKind): string {
  if (value === null || value === undefined || value === "") return "—"
  if (kind === "text") return String(value)
  if (kind === "date") return date(String(value))
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  if (kind === "kg") return kg(n)
  if (kind === "money") return `Rs. ${numberFmt.format(n)}`
  if (kind === "percent") return `${n.toFixed(1)}%`
  return numberFmt.format(n)
}

/** Rows turned into chart points, following the report's chart description. */
function chartPoints(chart: ReportChart, rows: ReportRow[]) {
  const only = chart.only
  const used = only ? rows.filter((r) => r[only.key] === only.value) : rows
  const points = new Map<string, Record<string, string | number>>()
  used.forEach((row, index) => {
    const name = String(row[chart.x] ?? "—")
    const id = chart.group ? name : `${index}`
    const point = points.get(id) ?? { name }
    for (const s of chart.series) point[s.label] = (Number(point[s.label]) || 0) + (Number(row[s.key]) || 0)
    points.set(id, point)
  })
  return [...points.values()]
}

function ReportChartCard({ report }: { report: ReportResult }) {
  const chart = report.chart
  if (!chart) return null
  const all = chartPoints(chart, report.rows)
  if (!all.length) return null
  const data = chart.type === "bar" ? all.slice(0, MAX_BARS) : all
  const short = (v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)
  const tooltip = <Tooltip cursor={cursorProps} content={<ChartTooltip format={(v) => show(v, chart.kind)} />} />
  return (
    <ChartCard title={report.title} contentClassName="h-72"
      description={data.length < all.length ? `The first ${data.length} of ${all.length} rows` : report.period.label}
      actions={<ChartLegend items={chart.series.map((s, i) => ({ label: s.label, color: COLORS[i % COLORS.length] }))} />}>
      <ResponsiveContainer width="100%" height="100%">
        {chart.type === "line" ? (
          <LineChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} tickFormatter={short} />
            <YAxis {...yAxisProps} />
            {tooltip}
            {chart.series.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.label} isAnimationActive={false} stroke={COLORS[i % COLORS.length]}
                strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} tickFormatter={short} />
            <YAxis {...yAxisProps} />
            {tooltip}
            {chart.series.map((s, i) => (
              <Bar key={s.key} dataKey={s.label} isAnimationActive={false} fill={COLORS[i % COLORS.length]}
                radius={[4, 4, 1, 1]} maxBarSize={36} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartCard>
  )
}

function ReportTable({ report }: { report: ReportResult }) {
  const align = (c: ReportColumn) => (NUMERIC.includes(c.kind) ? "text-right" : "")
  const hasTotals = Object.keys(report.totals).length > 0
  return (
    <div className="surface overflow-hidden rounded-xl">
      <Table aria-label={report.title}>
        <TableHeader className="bg-[color-mix(in_oklab,var(--card),var(--foreground)_3%)]">
          <TableRow className="hover:bg-transparent">
            {report.columns.map((c) => <TableHead key={c.key} className={cn("whitespace-nowrap", align(c))}>{c.label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.rows.length ? report.rows.map((row, index) => (
            <TableRow key={index}>
              {report.columns.map((c, position) => (
                <TableCell key={c.key} className={cn("h-11 whitespace-nowrap", align(c), position === 0 && "font-medium")}>
                  {position === 0 && row._href
                    ? <Link href={row._href} className="text-brand-text underline-offset-4 hover:underline">{show(row[c.key], c.kind)}</Link>
                    : show(row[c.key], c.kind)}
                </TableCell>
              ))}
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={report.columns.length} className="py-10 text-center text-muted-foreground">
                Nothing to show for this period.
              </TableCell>
            </TableRow>
          )}
          {hasTotals && report.rows.length > 0 && (
            <TableRow data-totals className="border-t-2 bg-muted/50 font-semibold hover:bg-muted/50">
              {report.columns.map((c) => (
                <TableCell key={c.key} className={cn("h-11 whitespace-nowrap", align(c))}>
                  {c.key in report.totals ? show(report.totals[c.key], c.kind) : ""}
                </TableCell>
              ))}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function ReportView({ report }: { report: ReportResult }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-xl font-semibold tracking-tight">{report.title}</h2>
          <Badge variant="outline">{report.group}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
        <p className="mt-1 text-xs text-muted-foreground" data-report-period>
          Period: {report.period.label} · Generated {new Date(report.generated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>

      {report.summary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {report.summary.map((s) => (
            <div key={s.label} className="surface rounded-xl p-3.5">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-heading text-xl font-bold tracking-tight wrap-anywhere"><Figure value={show(s.value, s.kind)} /></p>
            </div>
          ))}
        </div>
      )}

      <ReportChartCard report={report} />
      <ReportTable report={report} />

      {report.notes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Info className="size-4 text-muted-foreground" aria-hidden /> How these figures are worked out</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {report.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** The e-mail reports the system can send, and what has to run them. Read only. */
function ScheduledReports() {
  const schedules = useQuery<ReportSchedules>({ queryKey: ["reports/schedules"], queryFn: () => api("reports/schedules") })
  if (schedules.isPending) return <Skeleton className="h-40 w-full rounded-xl" />
  if (schedules.isError) return <ErrorState message={schedules.error.message} onRetry={() => schedules.refetch()} />
  const s = schedules.data
  return (
    <Card data-print="hide">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-muted-foreground" aria-hidden /> Scheduled e-mail reports</CardTitle>
        <CardDescription className="mt-0.5">{s.how}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          {s.reports.map((r) => (
            <div key={r.command} className="rounded-xl border p-3.5">
              <p className="font-medium">{r.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.contents}</p>
              <p className="mt-2 text-xs text-muted-foreground">Suggested time: {r.suggested}</p>
              <code className="mt-1 block rounded-md bg-muted px-2 py-1 text-xs wrap-anywhere">{r.command}</code>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {s.recipient_set
            ? "A management e-mail address is set, so the reports have somewhere to go."
            : "No management e-mail address is set (MANAGEMENT_EMAIL), so these reports cannot be sent yet."}
        </p>
      </CardContent>
    </Card>
  )
}

export function ReportCentre() {
  const [selected, setSelected] = useState<string | null>(null)
  const [period, setPeriod] = useState<DateFilterValue>({ type: "this_year" })

  const catalogue = useQuery<ReportCatalogue>({ queryKey: ["reports/catalogue"], queryFn: () => api("reports/catalogue") })
  const key = selected ?? catalogue.data?.reports[0]?.key
  const item = catalogue.data?.reports.find((r) => r.key === key)
  const params = dateParams(period)
  const valid = period.type !== "custom" || !period.start || !period.end || period.start <= period.end
  const report = useQuery<ReportResult>({
    queryKey: ["reports/run", key, params],
    queryFn: () => api(`reports/run/${key}`, { params }),
    enabled: !!key && valid,
    placeholderData: keepPreviousData,
  })

  if (catalogue.isError) return <ErrorState message={catalogue.error.message} onRetry={() => catalogue.refetch()} />
  if (catalogue.isPending) return <TableSkeleton rows={6} columns={4} />
  if (!key) return <EmptyState title="No reports" description="The report list is empty." />

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <nav aria-label="Reports" data-print="hide"
          className="surface scrollbar-thin max-h-72 space-y-4 overflow-y-auto rounded-xl p-3 lg:max-h-none lg:self-start">
          {catalogue.data.groups.map((group) => {
            const reports = catalogue.data.reports.filter((r) => r.group === group)
            if (!reports.length) return null
            return (
              <div key={group}>
                <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group}</p>
                <ul className="space-y-0.5">
                  {reports.map((r) => (
                    <li key={r.key}>
                      <button type="button" aria-pressed={r.key === key} title={r.description} onClick={() => setSelected(r.key)}
                        className={cn("w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                          r.key === key && "bg-brand/12 font-medium text-brand-text")}>
                        {r.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>

        <div className="min-w-0 space-y-4">
          <div className="surface flex flex-wrap items-center justify-between gap-3 rounded-xl p-3" data-print="hide">
            <div className="flex flex-wrap items-center gap-2">
              <DateFilter value={period} onChange={setPeriod} />
              {item && !item.dated && <span className="text-xs text-muted-foreground">This report always covers all time.</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <ExportButton path={`reports/run/${key}`} params={{ ...params, format: "csv" }} label="Export CSV" />
              <ExportButton path={`reports/run/${key}`} params={{ ...params, format: "xlsx" }} label="Export Excel" />
            </div>
          </div>

          {!valid ? <ErrorState message="Choose a start date on or before the end date." />
            : report.isError ? <ErrorState message={report.error.message} onRetry={() => report.refetch()} />
            : !report.data ? <TableSkeleton rows={6} columns={5} />
            : <div className={cn(report.isPlaceholderData && "opacity-60 transition-opacity")} aria-busy={report.isPlaceholderData}><ReportView report={report.data} /></div>}
        </div>
      </div>

      <ScheduledReports />
    </div>
  )
}
