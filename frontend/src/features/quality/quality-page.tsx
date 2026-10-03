"use client"

import { useQuery } from "@tanstack/react-query"
import {
  CheckCircle2, ClipboardCheck, Eye, ListChecks, LockOpen, Plus, RotateCcw, ShieldAlert, ShieldCheck, Wrench,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { axisProps, ChartCard, ChartLegend, ChartTooltip, cursorProps, gridProps, yAxisProps } from "@/components/common/chart"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { NameWithAvatar } from "@/components/common/identity"
import { ProgressBar } from "@/components/common/meters"
import { PageHeader } from "@/components/common/page-header"
import { type ExtraAction, RowActions } from "@/components/common/row-actions"
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDuties } from "@/features/auth/use-duty"
import { useSession } from "@/features/auth/use-session"
import { api } from "@/lib/api"
import { useAction, useDelete, useList } from "@/lib/crud"
import { date, kg, percent, plural } from "@/lib/format"
import { cn } from "@/lib/utils"
import type {
  CorrectiveAction, FabricLot, Inspection, QualityStandard, QualitySummary, StockEntry, UserSummary,
} from "@/types/api"
import { ActionDialog, InspectionDialog, QUALITY_LISTS, ReleaseDialog, StandardDialog } from "./quality-forms"
import { STAGE_LABELS, STAGES, limitText, stagesFor } from "./schemas"

type Tab = "dashboard" | "inspections" | "actions" | "standards"
type Editing =
  | { kind: "inspection"; record: Inspection | null }
  | { kind: "action"; record: CorrectiveAction | null; inspection?: Inspection }
  | { kind: "standard"; record: QualityStandard | null }
type Deleting = { kind: "inspection" | "action" | "standard"; id: number; label: string }

const ALL = "all"
const QUARANTINE = "quarantine"
const RESULT_FILTERS = [
  { value: "Pass", label: "Pass" }, { value: "Conditional", label: "Conditional" }, { value: "Fail", label: "Fail" },
  { value: QUARANTINE, label: "In quarantine" },
]

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
}

/** Result of an inspection, with its quarantine state. */
function Outcome({ inspection }: { inspection: Inspection }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge status={inspection.result} />
      {inspection.quarantined && <StatusBadge status="Quarantined" />}
      {inspection.released_at && <StatusBadge status="Released" />}
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

/** Read-only view of one inspection: what was measured, why it failed, who released it, and its actions. */
function InspectionDetails({ inspection, onOpenChange }: { inspection: Inspection | null; onOpenChange: (o: boolean) => void }) {
  const i = inspection
  return (
    <Sheet open={!!i} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 bg-elevated p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {i && (
          <>
            <SheetHeader className="border-b px-6 pt-5 pb-4">
              <SheetTitle className="font-heading text-lg font-semibold tracking-tight">Inspection {i.number}</SheetTitle>
              <SheetDescription>{STAGE_LABELS[i.stage]} · {i.material} · {i.target}</SheetDescription>
            </SheetHeader>
            <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <Outcome inspection={i} />
              <dl className="space-y-2">
                <Row label="Supplier">{i.vendor_name}</Row>
                <Row label="Inspected">{date(i.inspected_on)} by {i.inspector_name}</Row>
                {i.standard_name && <Row label="Standard">{i.standard_name}</Row>}
                {i.sample_kg && <Row label="Sample">{kg(i.sample_kg)}</Row>}
                {i.composition && <Row label="Composition">{i.composition}</Row>}
              </dl>
              {i.rejection_reason && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger-fg">
                  <span className="font-semibold">Why it failed:</span> {i.rejection_reason}
                </p>
              )}
              {i.notes && <p className="text-sm"><span className="text-muted-foreground">{i.result === "Conditional" ? "Condition: " : "Notes: "}</span>{i.notes}</p>}
              {i.released_at && (
                <p className="rounded-lg border border-info/30 bg-info/10 px-3 py-2.5 text-sm text-info-fg">
                  <span className="font-semibold">Released</span> on {date(i.released_at)} by {i.released_by_name}: {i.release_note}
                </p>
              )}
              {i.results.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Checklist</h3>
                  <ul className="divide-y rounded-xl border">
                    {i.results.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{r.name}</span>
                          {limitText(r) && <span className="block text-xs text-muted-foreground">{limitText(r)}</span>}
                        </span>
                        {r.value !== null && <span className="tabular-nums">{Number(r.value)}{r.unit && ` ${r.unit}`}</span>}
                        <StatusBadge status={r.passed ? "Pass" : "Fail"} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {i.actions.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Actions</h3>
                  <ul className="space-y-2">
                    {i.actions.map((a) => (
                      <li key={a.id} className="rounded-xl border px-3 py-2 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <span>{a.description}</span>
                          <StatusBadge status={a.status} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.kind}{a.owner_name && ` · ${a.owner_name}`}{a.due_date && ` · due ${date(a.due_date)}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function QualityPage() {
  const role = useSession().data?.role
  const admin = role === "admin"
  const can = useDuties()
  const releaser = can("release_quarantine")
  const stages = useMemo(() => stagesFor(can), [can])
  const [tab, setTab] = useState<Tab>("dashboard")
  const [resultFilter, setResultFilter] = useState(ALL)
  const [stageFilter, setStageFilter] = useState(ALL)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const [releasing, setReleasing] = useState<Inspection | null>(null)
  const [viewing, setViewing] = useState<Inspection | null>(null)

  const inspections = useList<Inspection>("quality/inspections")
  const actions = useList<CorrectiveAction>("quality/actions")
  const standards = useList<QualityStandard>("quality/standards")
  const deliveries = useList<StockEntry>("warehouse/stock")
  const lots = useList<FabricLot>("sorting/fabric-stock")
  const users = useList<UserSummary>("users/list")
  const summary = useQuery<QualitySummary>({ queryKey: ["quality/summary"], queryFn: () => api("quality/summary") })

  // `mutate` functions are stable, so the table columns below can depend on them
  const { mutate: completeAction } = useAction("quality/actions", "complete", { success: "Action marked as done.", invalidate: QUALITY_LISTS })
  const { mutate: reopenAction } = useAction("quality/actions", "reopen", { success: "Action reopened.", invalidate: QUALITY_LISTS })
  const removers = {
    inspection: useDelete("quality/inspections", { noun: "Inspection", invalidate: QUALITY_LISTS }),
    action: useDelete("quality/actions", { noun: "Action", invalidate: QUALITY_LISTS }),
    standard: useDelete("quality/standards", { noun: "Standard", invalidate: QUALITY_LISTS }),
  }

  const inspectionColumns = useMemo<TableColumn<Inspection>[]>(() => [
    { accessorKey: "number", header: "Inspection",
      cell: ({ row }) => (
        <span><span className="font-medium">{row.original.number}</span>
          <span className="block text-xs text-muted-foreground">{STAGE_LABELS[row.original.stage]}</span></span>
      ) },
    { accessorKey: "material", header: "Material",
      cell: ({ row }) => (
        <span>{row.original.material}<span className="block text-xs text-muted-foreground">{row.original.target}</span></span>
      ) },
    { accessorKey: "vendor_name", header: "Supplier" },
    { accessorKey: "inspector_name", header: "Inspector", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { id: "inspected_on", header: "Date", accessorFn: (r) => new Date(r.inspected_on), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.inspected_on)}</span> },
    { id: "checks", header: "Checks passed", enableSorting: false,
      cell: ({ row }) => {
        const total = row.original.results.length
        if (!total) return <span className="text-muted-foreground">—</span>
        const failed = row.original.failed_checks
        return <span className={cn("tabular-nums", failed && "font-medium text-danger-fg")}>{total - failed} of {total}</span>
      } },
    { accessorKey: "result", header: "Result", cell: ({ row }) => <Outcome inspection={row.original} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const i = row.original
        const mine = stages.includes(i.stage)
        const extra: ExtraAction[] = [{ label: "View details", view: true, icon: <Eye className="size-4" />, onSelect: () => setViewing(i) }]
        if (i.quarantined && releaser) extra.push({ label: "Release from quarantine", icon: <LockOpen className="size-4" />, onSelect: () => setReleasing(i) })
        if (mine) extra.push({ label: "Add action", icon: <Wrench className="size-4" />, onSelect: () => setEditing({ kind: "action", record: null, inspection: i }) })
        // Released inspections are final; failed ones are changed by whoever may release quarantine
        const editable = mine && !i.released_at && (i.result !== "Fail" || releaser)
        return <RowActions extra={extra}
          onEdit={editable ? () => setEditing({ kind: "inspection", record: i }) : undefined}
          onDelete={admin ? () => setDeleting({ kind: "inspection", id: i.id, label: i.number }) : undefined} />
      } },
  ], [admin, releaser, stages])

  const actionColumns = useMemo<TableColumn<CorrectiveAction>[]>(() => [
    { accessorKey: "inspection_number", header: "Inspection", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "kind", header: "Type" },
    { accessorKey: "description", header: "What has to be done",
      cell: ({ getValue }) => <span className="block max-w-80 truncate" title={getValue<string>()}>{getValue<string>()}</span> },
    { accessorKey: "owner_name", header: "Responsible",
      cell: ({ getValue }) => getValue<string | null>() ? <NameWithAvatar name={getValue<string>()} /> : <span className="text-muted-foreground">—</span> },
    { id: "due_date", header: "Due", accessorFn: (r) => (r.due_date ? new Date(r.due_date) : new Date(8.64e15)), sortFn: "datetime",
      cell: ({ row }) => row.original.due_date
        ? <span className={row.original.overdue ? "font-medium text-danger-fg" : "text-muted-foreground"}>{date(row.original.due_date)}{row.original.overdue && " · overdue"}</span>
        : <span className="text-muted-foreground">—</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const a = row.original
        const extra = a.status === "Open"
          ? [{ label: "Mark as done", icon: <CheckCircle2 className="size-4" />, onSelect: () => completeAction({ id: a.id }) }]
          : [{ label: "Reopen", icon: <RotateCcw className="size-4" />, onSelect: () => reopenAction({ id: a.id }) }]
        return <RowActions extra={extra}
          onEdit={a.status === "Open" ? () => setEditing({ kind: "action", record: a }) : undefined}
          onDelete={admin ? () => setDeleting({ kind: "action", id: a.id, label: `the action for ${a.inspection_number}` }) : undefined} />
      } },
  ], [admin, completeAction, reopenAction])

  const standardColumns = useMemo<TableColumn<QualityStandard>[]>(() => [
    { accessorKey: "name", header: "Standard", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "stage", header: "Stage", cell: ({ row }) => STAGE_LABELS[row.original.stage] },
    { accessorKey: "material_type", header: "Material", cell: ({ getValue }) => getValue<string>() || <span className="text-muted-foreground">Any</span> },
    { id: "checks", header: "Checks", accessorFn: (r) => r.checks.map((c) => c.name).join(", "),
      cell: ({ row }) => (
        <span className="block max-w-96 truncate" title={row.original.checks.map((c) => `${c.name}${limitText(c) ? ` (${limitText(c)})` : ""}`).join("\n")}>
          {row.original.checks.map((c) => c.name).join(", ")}
        </span>
      ) },
    { accessorKey: "inspections", header: "Used", sortFn: "basic", cell: ({ getValue }) => plural(getValue<number>(), "time") },
    { id: "is_active", header: "Status", accessorFn: (r) => (r.is_active ? "In use" : "Not in use"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "In use" : "Not in use"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => admin ? <RowActions onEdit={() => setEditing({ kind: "standard", record: row.original })}
        onDelete={() => setDeleting({ kind: "standard", id: row.original.id, label: row.original.name })} /> : null },
  ], [admin])

  const canInspect = stages.length > 0
  const addFor: Record<Tab, { label: string; open: () => void } | null> = {
    dashboard: canInspect ? { label: "Record inspection", open: () => setEditing({ kind: "inspection", record: null }) } : null,
    inspections: canInspect ? { label: "Record inspection", open: () => setEditing({ kind: "inspection", record: null }) } : null,
    actions: canInspect ? { label: "Add action", open: () => setEditing({ kind: "action", record: null }) } : null,
    standards: admin ? { label: "New standard", open: () => setEditing({ kind: "standard", record: null }) } : null,
  }

  const core = [inspections, summary]
  const loadError = core.find((q) => q.isError)
  const s = summary.data
  const add = addFor[tab]
  const quarantined = (inspections.data ?? []).filter((i) => i.quarantined)
  const shown = (inspections.data ?? []).filter((i) =>
    (stageFilter === ALL || i.stage === stageFilter)
    && (resultFilter === ALL || (resultFilter === QUARANTINE ? i.quarantined : i.result === resultFilter)))
  const trend = (s?.trend ?? []).map((t) => ({ ...t, month: monthLabel(t.month) }))
  const mostFailures = Math.max(1, ...(s?.defects ?? []).map((d) => d.failures))

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Quality" icon="quality"
        description="Inspections of deliveries and fabric lots, quarantine of failed material, and corrective actions."
        actions={add && <Button onClick={add.open}><Plus className="size-4" /> {add.label}</Button>} />

      {loadError ? (
        <ErrorState message={loadError.error!.message} onRetry={() => core.forEach((q) => q.refetch())} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="inspections">Inspections</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="standards">Standards</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4 space-y-6">
            {!s || !inspections.data ? <CardsSkeleton /> : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Inspections, this month" icon={ClipboardCheck} tone="quality" value={s.inspections_this_month}
                    hint={s.pass_pct_this_month == null ? "None recorded yet" : `${percent(s.pass_pct_this_month)} accepted`}
                    muted={s.inspections_this_month === 0} />
                  <StatCard label="In quarantine" icon={ShieldAlert} tone={s.quarantined ? "danger" : "success"} value={s.quarantined}
                    hint={s.quarantined ? "Blocked from processing and sales" : "Nothing is held"} muted={s.quarantined === 0} />
                  <StatCard label="Failed, this month" icon={ShieldCheck} tone={s.failed_this_month ? "warning" : "success"} value={s.failed_this_month}
                    hint={`${plural(s.conditional_this_month, "conditional acceptance")}`} muted={s.failed_this_month === 0} />
                  <StatCard label="Open actions" icon={ListChecks} tone={s.overdue_actions ? "danger" : "info"} value={s.open_actions}
                    hint={s.overdue_actions ? `${s.overdue_actions} overdue` : "None overdue"} muted={s.open_actions === 0} />
                </div>

                <div className="grid gap-4 lg:grid-cols-5">
                  <Card className="animate-rise lg:col-span-2">
                    <CardHeader>
                      <CardTitle>In quarantine</CardTitle>
                      <CardDescription className="mt-0.5">{releaser ? "Release material once the problem is solved" : "Your role can't release material"}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {quarantined.length ? quarantined.map((i) => (
                        <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/25 bg-danger/5 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{i.material} <span className="font-normal text-muted-foreground">{i.target} · {i.vendor_name}</span></p>
                            <p className="truncate text-xs text-muted-foreground" title={i.rejection_reason}>{i.number}: {i.rejection_reason}</p>
                          </div>
                          {releaser
                            ? <Button size="sm" variant="outline" onClick={() => setReleasing(i)}><LockOpen className="size-3.5" /> Release</Button>
                            : <StatusBadge status="Quarantined" />}
                        </div>
                      )) : (
                        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                          <CheckCircle2 className="size-4 text-success-fg" aria-hidden /> No material is in quarantine.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <ChartCard className="lg:col-span-3" title="Inspection results by month" description="Last 6 months" contentClassName="h-64"
                    actions={<ChartLegend items={[{ label: "Pass", color: "var(--success)" }, { label: "Conditional", color: "var(--warning)" }, { label: "Fail", color: "var(--danger)" }]} />}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trend} margin={{ left: 0, right: 8, top: 8 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="month" {...axisProps} />
                        <YAxis {...yAxisProps} allowDecimals={false} />
                        <Tooltip cursor={cursorProps} content={<ChartTooltip />} />
                        <Bar dataKey="Pass" stackId="r" isAnimationActive={false} fill="var(--success)" maxBarSize={48} />
                        <Bar dataKey="Conditional" stackId="r" isAnimationActive={false} fill="var(--warning)" maxBarSize={48} />
                        <Bar dataKey="Fail" stackId="r" isAnimationActive={false} fill="var(--danger)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="animate-rise">
                    <CardHeader>
                      <CardTitle>Defect analysis</CardTitle>
                      <CardDescription className="mt-0.5">Checks that fail most often, last 6 months</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3.5">
                      {s.defects.length ? s.defects.map((d) => (
                        <div key={d.name}>
                          <div className="mb-1.5 flex justify-between gap-2 text-sm">
                            <span className="truncate font-medium">{d.name}</span>
                            <span className="shrink-0 text-muted-foreground">{d.failures} of {d.checks} failed · {percent(d.failure_pct)}</span>
                          </div>
                          <ProgressBar value={(d.failures / mostFailures) * 100} size="sm" tone="danger" label={`${d.name} failures`} />
                        </div>
                      )) : <EmptyState icon={ShieldCheck} title="No failed checks" description="Checks that fail show here, most frequent first." />}
                    </CardContent>
                  </Card>

                  <Card className="animate-rise">
                    <CardHeader>
                      <CardTitle>Supplier quality</CardTitle>
                      <CardDescription className="mt-0.5">Incoming inspections accepted per supplier, lowest first</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3.5">
                      {s.suppliers.length ? s.suppliers.slice(0, 8).map((v) => (
                        <div key={v.vendor}>
                          <div className="mb-1.5 flex justify-between gap-2 text-sm">
                            <span className="truncate font-medium">{v.name}</span>
                            <span className="shrink-0 text-muted-foreground">{v.inspections - v.failed} of {v.inspections} accepted · {percent(v.pass_pct)}</span>
                          </div>
                          <ProgressBar value={v.pass_pct} size="sm" label={`${v.name} accepted`}
                            tone={v.pass_pct >= 90 ? "success" : v.pass_pct >= 70 ? "warning" : "danger"} />
                        </div>
                      )) : <EmptyState icon={ClipboardCheck} title="No incoming inspections" description="Inspect deliveries to rate suppliers." />}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="inspections" className="mt-4">
            {inspections.isPending ? <TableSkeleton columns={8} /> : (
              <DataTable columns={inspectionColumns} data={shown} exportName="quality-inspections"
                searchPlaceholder="Search inspection, material, supplier…" emptyTitle="No inspections"
                emptyDescription={canInspect ? "Record one with “Record inspection”." : "Inspections recorded by the teams show here."}
                initialSorting={[{ id: "inspected_on", desc: true }]}
                filters={[
                  ...(stageFilter !== ALL ? [{ label: `Stage: ${STAGE_LABELS[stageFilter as keyof typeof STAGE_LABELS]}`, onClear: () => setStageFilter(ALL) }] : []),
                  ...(resultFilter !== ALL ? [{ label: `Result: ${RESULT_FILTERS.find((r) => r.value === resultFilter)?.label}`, onClear: () => setResultFilter(ALL) }] : []),
                ]}
                toolbar={<>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="h-9 w-[170px]" aria-label="Stage"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All stages</SelectItem>
                      {STAGES.map((st) => <SelectItem key={st} value={st}>{STAGE_LABELS[st]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={resultFilter} onValueChange={setResultFilter}>
                    <SelectTrigger className="h-9 w-[160px]" aria-label="Result"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All results</SelectItem>
                      {RESULT_FILTERS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </>} />
            )}
          </TabsContent>

          <TabsContent value="actions" className="mt-4">
            {actions.isError ? <ErrorState message={actions.error.message} onRetry={() => actions.refetch()} />
              : actions.isPending ? <TableSkeleton columns={7} /> : (
                <DataTable columns={actionColumns} data={actions.data} exportName="quality-actions"
                  searchPlaceholder="Search action, inspection, person…" emptyTitle="No corrective actions"
                  emptyDescription="Add one from an inspection's menu when a problem needs follow-up." />
              )}
          </TabsContent>

          <TabsContent value="standards" className="mt-4">
            {standards.isError ? <ErrorState message={standards.error.message} onRetry={() => standards.refetch()} />
              : standards.isPending ? <TableSkeleton columns={6} /> : (
                <DataTable columns={standardColumns} data={standards.data} exportName="quality-standards"
                  searchPlaceholder="Search standard, material, check…" emptyTitle="No quality standards"
                  emptyDescription={admin ? "Create a checklist with limits using “New standard”." : "Admins set up the checklists used in inspections."} />
              )}
          </TabsContent>
        </Tabs>
      )}

      <InspectionDialog open={editing?.kind === "inspection"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "inspection" ? editing.record : null} stages={stages}
        deliveries={deliveries.data ?? []} lots={lots.data ?? []} standards={standards.data ?? []} />
      <ActionDialog open={editing?.kind === "action"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "action" ? editing.record : null} forInspection={editing?.kind === "action" ? editing.inspection : null}
        inspections={(inspections.data ?? []).filter((i) => stages.includes(i.stage))} users={users.data ?? []} />
      <StandardDialog open={editing?.kind === "standard"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "standard" ? editing.record : null} />
      <ReleaseDialog inspection={releasing} onOpenChange={(o) => !o && setReleasing(null)} />
      <InspectionDetails inspection={viewing} onOpenChange={(o) => !o && setViewing(null)} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.label}?`}
        description={deleting?.kind === "inspection"
          ? "The inspection, its checklist and its actions are removed. If it holds material in quarantine, that material is freed."
          : "It will be removed. Records that depend on it can't be deleted."}
        onConfirm={async () => {
          if (deleting) await removers[deleting.kind].mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
