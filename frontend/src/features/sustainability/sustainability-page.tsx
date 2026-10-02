"use client"

import { useQuery } from "@tanstack/react-query"
import { Droplets, Plus, Recycle, Target, Trash2, Undo2, Zap } from "lucide-react"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { axisProps, ChartCard, ChartLegend, ChartTooltip, cursorProps, gridProps, yAxisProps } from "@/components/common/chart"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, dateParams, periodLabel } from "@/components/common/date-filter"
import { NameWithAvatar } from "@/components/common/identity"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { SectionTitle } from "@/components/common/section-title"
import { StatCard } from "@/components/common/stat-card"
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/features/auth/use-session"
import { api } from "@/lib/api"
import { useDelete, useList } from "@/lib/crud"
import { date, kg, plural, rupees } from "@/lib/format"
import type { FabricLot } from "@/types/api"
import type {
  SustainabilitySummary, SustainabilityTarget, TargetResult, UtilityReading, WasteCategory, WasteRecord,
} from "@/types/sustainability"
import { EnvironmentalReport, amount, pct, periodParams } from "./environmental-report"
import {
  CLASSIFICATION_LABELS, CLASSIFICATION_TONES, CLASSIFICATIONS, METRIC_LABELS, METRIC_UNITS, STAGES, UTILITIES,
} from "./schemas"
import { CategoryDialog, ReadingDialog, SUSTAINABILITY_LISTS, TargetDialog, WasteDialog } from "./sustainability-forms"

type Tab = "dashboard" | "waste" | "utilities" | "report" | "setup"
type Editing =
  | { kind: "waste"; record: WasteRecord | null }
  | { kind: "reading"; record: UtilityReading | null }
  | { kind: "category"; record: WasteCategory | null }
  | { kind: "target"; record: SustainabilityTarget | null }
type Deleting = { kind: "waste" | "reading" | "category" | "target"; id: number; label: string }

const ALL = "all"
const INPUT_COLOR = "var(--chart-2)"
const OUTPUT_COLOR = "var(--stage-sustainability)"
const n = (v: string | number | null | undefined) => Number(v) || 0
const dash = <span className="text-muted-foreground">—</span>

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
}

/** "75 %", "40 L per kg" */
const withUnit = (value: string, metric: TargetResult["metric"]) =>
  `${amount(value)}${METRIC_UNITS[metric] === "%" ? "%" : ` ${METRIC_UNITS[metric]}`}`

function TargetRow({ target }: { target: TargetResult }) {
  const status = target.met == null ? "No data" : target.met ? "On target" : "Off target"
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{METRIC_LABELS[target.metric]}</p>
        <p className="text-xs text-muted-foreground">
          {target.direction} {withUnit(target.target_value, target.metric)}
          {target.actual != null && <> · now <span className="font-medium text-foreground">{withUnit(target.actual, target.metric)}</span></>}
        </p>
      </div>
      <StatusBadge status={status} tone={target.met == null ? "neutral" : target.met ? "success" : "danger"} />
    </div>
  )
}

export function SustainabilityPage() {
  const session = useSession().data
  const admin = session?.role === "admin"
  const userId = session?.id
  const [tab, setTab] = useState<Tab>("dashboard")
  const [period, setPeriod] = useState<DateFilterValue>({ type: "this_month" })
  const [wastePeriod, setWastePeriod] = useState<DateFilterValue>({ type: "all" })
  const [readingPeriod, setReadingPeriod] = useState<DateFilterValue>({ type: "all" })
  const [classFilter, setClassFilter] = useState(ALL)
  const [stageFilter, setStageFilter] = useState(ALL)
  const [utilityFilter, setUtilityFilter] = useState(ALL)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)

  const summaryParams = periodParams(period)
  const summary = useQuery<SustainabilitySummary>({
    queryKey: ["sustainability/summary", summaryParams], queryFn: () => api("sustainability/summary", { params: summaryParams }),
  })
  const records = useList<WasteRecord>("sustainability/waste-records", dateParams(wastePeriod))
  const readings = useList<UtilityReading>("sustainability/utility-readings", dateParams(readingPeriod))
  const categories = useList<WasteCategory>("sustainability/waste-categories")
  const targets = useList<SustainabilityTarget>("sustainability/targets")
  const lots = useList<FabricLot>("sorting/fabric-stock")

  const removers = {
    waste: useDelete("sustainability/waste-records", { noun: "Waste record", invalidate: SUSTAINABILITY_LISTS }),
    reading: useDelete("sustainability/utility-readings", { noun: "Reading", invalidate: SUSTAINABILITY_LISTS }),
    category: useDelete("sustainability/waste-categories", { noun: "Waste category", invalidate: SUSTAINABILITY_LISTS }),
    target: useDelete("sustainability/targets", { noun: "Target", invalidate: SUSTAINABILITY_LISTS }),
  }

  const wasteColumns = useMemo<TableColumn<WasteRecord>[]>(() => [
    { id: "date", header: "Date", accessorFn: (r) => new Date(r.date), sortFn: "datetime",
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{date(row.original.date)}</span> },
    { accessorKey: "category_name", header: "Waste",
      cell: ({ row }) => (
        <span className="flex flex-col items-start gap-1">
          <span className="font-medium">{row.original.category_name}</span>
          <StatusBadge status={CLASSIFICATION_LABELS[row.original.classification]} tone={CLASSIFICATION_TONES[row.original.classification]} />
        </span>
      ) },
    { accessorKey: "stage", header: "From",
      cell: ({ row }) => (
        <span>{row.original.stage}
          {row.original.fabric && <span className="block text-xs text-muted-foreground">Lot #{row.original.fabric} · {row.original.fabric_material}</span>}
        </span>
      ) },
    { id: "quantity_kg", header: "Weight", accessorFn: (r) => n(r.quantity_kg), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{kg(row.original.quantity_kg)}</span> },
    { id: "disposal", header: "Disposal", accessorFn: (r) => [r.disposal_method, r.disposed_to].filter(Boolean).join(" · "),
      cell: ({ row }) => (
        <span className="block max-w-56">{row.original.disposal_method}
          {row.original.disposed_to && <span className="block truncate text-xs text-muted-foreground" title={row.original.disposed_to}>{row.original.disposed_to}</span>}
        </span>
      ) },
    { accessorKey: "disposal_reference", header: "Reference", cell: ({ getValue }) => getValue<string>() || dash },
    { id: "money", header: "Cost / sold for", accessorFn: (r) => n(r.revenue) - n(r.disposal_cost), sortFn: "basic",
      cell: ({ row }) => {
        const cost = n(row.original.disposal_cost)
        const revenue = n(row.original.revenue)
        if (!cost && !revenue) return dash
        return (
          <span className="tabular-nums">
            {cost > 0 && <span className="block">{rupees(cost)} cost</span>}
            {revenue > 0 && <span className="block text-success-fg">{rupees(revenue)} sold</span>}
          </span>
        )
      } },
    { accessorKey: "recorded_by_name", header: "Recorded by", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const r = row.original
        // Supervisors change their own entries; deleting is for admins
        if (!admin && r.recorded_by !== userId) return null
        return <RowActions onEdit={() => setEditing({ kind: "waste", record: r })}
          onDelete={admin ? () => setDeleting({ kind: "waste", id: r.id, label: `the ${r.category_name.toLowerCase()} record of ${date(r.date)}` }) : undefined} />
      } },
  ], [admin, userId])

  const readingColumns = useMemo<TableColumn<UtilityReading>[]>(() => [
    { id: "date", header: "Date", accessorFn: (r) => new Date(r.date), sortFn: "datetime",
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{date(row.original.date)}</span> },
    { accessorKey: "utility", header: "Utility", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "quantity", header: "Used", accessorFn: (r) => n(r.quantity), sortFn: "basic",
      cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{amount(row.original.quantity)} {row.original.unit}</span> },
    { id: "cost", header: "Cost", accessorFn: (r) => n(r.cost), sortFn: "basic",
      cell: ({ row }) => n(row.original.cost) ? <span className="tabular-nums">{rupees(row.original.cost)}</span> : dash },
    { id: "stage", header: "Area", accessorFn: (r) => r.stage || "Whole factory" },
    { accessorKey: "meter_reference", header: "Meter or bill", cell: ({ getValue }) => getValue<string>() || dash },
    { accessorKey: "recorded_by_name", header: "Recorded by", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const r = row.original
        if (!admin && r.recorded_by !== userId) return null
        return <RowActions onEdit={() => setEditing({ kind: "reading", record: r })}
          onDelete={admin ? () => setDeleting({ kind: "reading", id: r.id, label: `the ${r.utility.toLowerCase()} reading of ${date(r.date)}` }) : undefined} />
      } },
  ], [admin, userId])

  const categoryColumns = useMemo<TableColumn<WasteCategory>[]>(() => [
    { accessorKey: "name", header: "Category", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "classification", header: "Classification", accessorFn: (r) => CLASSIFICATION_LABELS[r.classification],
      cell: ({ row }) => <StatusBadge status={CLASSIFICATION_LABELS[row.original.classification]} tone={CLASSIFICATION_TONES[row.original.classification]} /> },
    { accessorKey: "description", header: "Description",
      cell: ({ getValue }) => getValue<string>() ? <span className="block max-w-80 truncate" title={getValue<string>()}>{getValue<string>()}</span> : dash },
    { accessorKey: "records", header: "Used", sortFn: "basic", cell: ({ getValue }) => plural(getValue<number>(), "record") },
    { id: "is_active", header: "Status", accessorFn: (r) => (r.is_active ? "In use" : "Not in use"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "In use" : "Not in use"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => admin ? <RowActions onEdit={() => setEditing({ kind: "category", record: row.original })}
        onDelete={() => setDeleting({ kind: "category", id: row.original.id, label: row.original.name })} /> : null },
  ], [admin])

  const targetColumns = useMemo<TableColumn<SustainabilityTarget>[]>(() => [
    { id: "metric", header: "Figure", accessorFn: (r) => METRIC_LABELS[r.metric],
      cell: ({ row }) => <span className="font-medium">{METRIC_LABELS[row.original.metric]}</span> },
    { id: "target", header: "Target", accessorFn: (r) => `${r.direction} ${r.target_value}`,
      cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{row.original.direction} {withUnit(row.original.target_value, row.original.metric)}</span> },
    { accessorKey: "period", header: "Period", cell: ({ getValue }) => getValue<string>() || dash },
    { id: "is_active", header: "Status", accessorFn: (r) => (r.is_active ? "In use" : "Not in use"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "In use" : "Not in use"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => admin ? <RowActions onEdit={() => setEditing({ kind: "target", record: row.original })}
        onDelete={() => setDeleting({ kind: "target", id: row.original.id, label: `the target for ${METRIC_LABELS[row.original.metric].toLowerCase()}` })} /> : null },
  ], [admin])

  const addWaste = { label: "Add waste record", open: () => setEditing({ kind: "waste", record: null }) }
  const addFor: Record<Tab, { label: string; open: () => void } | null> = {
    dashboard: addWaste,
    waste: addWaste,
    utilities: { label: "Add reading", open: () => setEditing({ kind: "reading", record: null }) },
    report: null,
    setup: null,
  }

  const add = addFor[tab]
  const s = summary.data
  const shownRecords = (records.data ?? []).filter((r) =>
    (classFilter === ALL || r.classification === classFilter) && (stageFilter === ALL || r.stage === stageFilter))
  const shownReadings = (readings.data ?? []).filter((r) => utilityFilter === ALL || r.utility === utilityFilter)
  const trend = (s?.trend ?? []).map((t) => ({
    ...t, month: monthLabel(t.month), Sorted: n(t.input_kg), Dried: n(t.output_kg),
  }))
  const inPeriod = periodLabel(period).toLowerCase()

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Sustainability" icon="sustainability"
        description="Waste handled, material recovery, and water, energy and chemical use. The rates are worked out from the factory's own records."
        actions={add && <Button onClick={add.open}><Plus className="size-4" /> {add.label}</Button>} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="waste">Waste records</TabsTrigger>
          <TabsTrigger value="utilities">Utilities</TabsTrigger>
          <TabsTrigger value="report">Environmental report</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4 space-y-6">
          <DateFilter value={period} onChange={setPeriod} />
          {summary.isError ? <ErrorState message={summary.error.message} onRetry={() => summary.refetch()} />
            : !s ? <CardsSkeleton count={5} />
            : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <StatCard label="Recovery rate" icon={Recycle} tone="sustainability" value={pct(s.recovery.rate_pct)}
                    hint={s.recovery.rate_pct == null ? "No sorting completed in this period" : `${kg(s.recovery.output_kg)} dried from ${kg(s.recovery.input_kg)} sorted`}
                    muted={s.recovery.rate_pct == null} />
                  <StatCard label="Waste handled" icon={Trash2} tone="warning" value={kg(s.waste.total_kg)}
                    hint={n(s.waste.hazardous_kg) ? `${kg(s.waste.hazardous_kg)} hazardous` : plural(s.waste.records, "record")}
                    muted={!s.waste.records} />
                  <StatCard label="Diverted from landfill" icon={Undo2} tone="success" value={pct(s.waste.diverted_pct)}
                    hint={s.waste.diverted_pct == null ? "No waste recorded" : `${kg(s.waste.landfill_kg)} went to landfill`}
                    muted={s.waste.diverted_pct == null} />
                  <StatCard label="Water per kg" icon={Droplets} tone="info"
                    value={s.utilities.water_l_per_kg == null ? "—" : `${amount(s.utilities.water_l_per_kg)} L`}
                    hint={`${amount(s.utilities.water_m3)} m3 used`} muted={s.utilities.water_l_per_kg == null} />
                  <StatCard label="Energy per kg" icon={Zap} tone="running"
                    value={s.utilities.energy_kwh_per_kg == null ? "—" : `${amount(s.utilities.energy_kwh_per_kg)} kWh`}
                    hint={`${amount(s.utilities.energy_kwh)} kWh used`} muted={s.utilities.energy_kwh_per_kg == null} />
                </div>

                <div className="grid gap-4 lg:grid-cols-5">
                  <ChartCard className="lg:col-span-3" title="Material sorted and dried by month" description={`Last ${trend.length} months`} contentClassName="h-64"
                    actions={<ChartLegend items={[{ label: "Sorted", color: INPUT_COLOR }, { label: "Dried", color: OUTPUT_COLOR }]} />}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trend} margin={{ left: 0, right: 8, top: 8 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="month" {...axisProps} />
                        <YAxis {...yAxisProps} />
                        <Tooltip cursor={cursorProps} content={
                          <ChartTooltip format={(v) => kg(v)}
                            footer={(p) => `Recovery ${pct(p.recovery_pct as string | null)} · waste ${kg(p.waste_kg as string)} · water ${amount(p.water_m3 as string)} m3 · power ${amount(p.energy_kwh as string)} kWh`} />
                        } />
                        <Bar dataKey="Sorted" isAnimationActive={false} fill={INPUT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="Dried" isAnimationActive={false} fill={OUTPUT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <Card className="animate-rise lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Targets</CardTitle>
                      <CardDescription className="mt-0.5">Measured over {inPeriod}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {s.targets.length ? s.targets.map((t) => <TargetRow key={t.id} target={t} />) : (
                        <EmptyState icon={Target} title="No targets yet"
                          description={admin ? "Add targets in the Setup tab." : "An admin sets the targets."} />
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="animate-rise">
                  <CardHeader>
                    <CardTitle>How these are calculated</CardTitle>
                    <CardDescription className="mt-0.5">Every rate comes from sessions, deliveries, readings and waste records. None is typed in.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                      {s.definitions.map((d) => (
                        <div key={d.name} className="min-w-0 text-sm">
                          <dt className="font-medium">{d.name}</dt>
                          <dd className="text-muted-foreground">{d.text}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              </>
            )}
        </TabsContent>

        <TabsContent value="waste" className="mt-4">
          {records.isError ? <ErrorState message={records.error.message} onRetry={() => records.refetch()} />
            : records.isPending ? <TableSkeleton columns={8} /> : (
              <DataTable columns={wasteColumns} data={shownRecords} exportName="waste-records"
                searchPlaceholder="Search waste, disposal, reference…" emptyTitle="No waste records"
                emptyDescription="Record waste that was weighed and disposed of with “Add waste record”."
                initialSorting={[{ id: "date", desc: true }]}
                filters={[
                  ...(classFilter !== ALL ? [{ label: `Classification: ${CLASSIFICATION_LABELS[classFilter as keyof typeof CLASSIFICATION_LABELS]}`, onClear: () => setClassFilter(ALL) }] : []),
                  ...(stageFilter !== ALL ? [{ label: `From: ${stageFilter}`, onClear: () => setStageFilter(ALL) }] : []),
                ]}
                toolbar={<>
                  <DateFilter value={wastePeriod} onChange={setWastePeriod} />
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger className="h-9 w-[180px]" aria-label="Classification"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All classifications</SelectItem>
                      {CLASSIFICATIONS.map((c) => <SelectItem key={c} value={c}>{CLASSIFICATION_LABELS[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="h-9 w-[160px]" aria-label="Source stage"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All stages</SelectItem>
                      {STAGES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </>} />
            )}
        </TabsContent>

        <TabsContent value="utilities" className="mt-4">
          {readings.isError ? <ErrorState message={readings.error.message} onRetry={() => readings.refetch()} />
            : readings.isPending ? <TableSkeleton columns={7} /> : (
              <DataTable columns={readingColumns} data={shownReadings} exportName="utility-readings"
                searchPlaceholder="Search utility, area, meter…" emptyTitle="No utility readings"
                emptyDescription="Enter water, power and fuel use with “Add reading”."
                initialSorting={[{ id: "date", desc: true }]}
                filters={utilityFilter !== ALL ? [{ label: `Utility: ${utilityFilter}`, onClear: () => setUtilityFilter(ALL) }] : []}
                toolbar={<>
                  <DateFilter value={readingPeriod} onChange={setReadingPeriod} />
                  <Select value={utilityFilter} onValueChange={setUtilityFilter}>
                    <SelectTrigger className="h-9 w-[160px]" aria-label="Utility"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All utilities</SelectItem>
                      {UTILITIES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </>} />
            )}
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <EnvironmentalReport />
        </TabsContent>

        <TabsContent value="setup" className="mt-4 space-y-8">
          <section className="space-y-4">
            <SectionTitle action={admin && (
              <Button size="sm" variant="outline" onClick={() => setEditing({ kind: "category", record: null })}><Plus className="size-4" /> New category</Button>
            )}>Waste categories</SectionTitle>
            {categories.isError ? <ErrorState message={categories.error.message} onRetry={() => categories.refetch()} />
              : categories.isPending ? <TableSkeleton columns={5} rows={4} /> : (
                <DataTable columns={categoryColumns} data={categories.data} searchPlaceholder="Search categories…" emptyTitle="No waste categories"
                  emptyDescription={admin ? "Add one with “New category”." : "An admin sets up the waste categories."} />
              )}
          </section>
          <section className="space-y-4">
            <SectionTitle action={admin && (
              <Button size="sm" variant="outline" onClick={() => setEditing({ kind: "target", record: null })}><Plus className="size-4" /> New target</Button>
            )}>Targets</SectionTitle>
            {targets.isError ? <ErrorState message={targets.error.message} onRetry={() => targets.refetch()} />
              : targets.isPending ? <TableSkeleton columns={4} rows={4} /> : (
                <DataTable columns={targetColumns} data={targets.data} emptyTitle="No targets"
                  emptyDescription={admin ? "Set a goal for a calculated figure with “New target”." : "An admin sets the targets."} />
              )}
          </section>
        </TabsContent>
      </Tabs>

      <WasteDialog open={editing?.kind === "waste"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "waste" ? editing.record : null} categories={categories.data ?? []} lots={lots.data ?? []} />
      <ReadingDialog open={editing?.kind === "reading"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "reading" ? editing.record : null} />
      <CategoryDialog open={editing?.kind === "category"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "category" ? editing.record : null} />
      <TargetDialog open={editing?.kind === "target"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "target" ? editing.record : null} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.label}?`}
        description={deleting?.kind === "category"
          ? "It will be removed. A category that has waste records can't be deleted; switch it off instead."
          : "It will be removed, and the figures that use it will change."}
        onConfirm={async () => {
          if (deleting) await removers[deleting.kind].mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
