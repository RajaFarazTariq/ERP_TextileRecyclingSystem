"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Ban, CalendarClock, CheckCircle2, ClipboardList, Coins, Cog, PackagePlus, Play, Plus, Timer, TriangleAlert, Wrench,
} from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { NameWithAvatar } from "@/components/common/identity"
import { SegmentedBar } from "@/components/common/meters"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { CardsSkeleton, ErrorState, TableSkeleton } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/features/auth/use-session"
import { api } from "@/lib/api"
import { useAction, useDelete, useList } from "@/lib/crud"
import { date, plural, rupees } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Dryer, Tank, UserSummary } from "@/types/api"
import type { Machine, MaintenanceSchedule, MaintenanceSummary, SparePart, WorkOrder } from "@/types/maintenance"
import {
  CompleteDialog, MAINTENANCE_LISTS, MachineDialog, PartDialog, ReceiveDialog, ScheduleDialog, WorkOrderDialog, WorkOrderSheet,
} from "./maintenance-forms"
import { PerformancePanel } from "./performance-panel"
import { KINDS, MACHINE_TONES, ORDER_STATUSES, ORDER_TONES, PRIORITY_TONES, dueText } from "./schemas"

type Tab = "dashboard" | "machines" | "orders" | "schedules" | "parts" | "performance"
type Editing =
  | { kind: "machine"; record: Machine | null }
  | { kind: "order"; record: WorkOrder | null }
  | { kind: "schedule"; record: MaintenanceSchedule | null }
  | { kind: "part"; record: SparePart | null }
type Deleting = { kind: "machine" | "order" | "schedule" | "part"; id: number; label: string }

const ALL = "all"
const ACTIVE = "active"
const amount = (v: string | number) => Number(v).toLocaleString("en-PK", { maximumFractionDigits: 2 })
const dash = <span className="text-muted-foreground">—</span>

export function MaintenancePage() {
  const session = useSession().data
  const admin = session?.role === "admin"
  const myId = session?.id
  const [tab, setTab] = useState<Tab>("dashboard")
  const [statusFilter, setStatusFilter] = useState(ACTIVE)
  const [kindFilter, setKindFilter] = useState(ALL)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const [completing, setCompleting] = useState<WorkOrder | null>(null)
  const [cancelling, setCancelling] = useState<WorkOrder | null>(null)
  const [receiving, setReceiving] = useState<SparePart | null>(null)
  const [viewingId, setViewingId] = useState<number | null>(null)

  const machines = useList<Machine>("maintenance/machines")
  const orders = useList<WorkOrder>("maintenance/work-orders")
  const schedules = useList<MaintenanceSchedule>("maintenance/schedules")
  const parts = useList<SparePart>("maintenance/parts")
  // Only the machine form (admin) needs these; other roles may not read them
  const tanks = useList<Tank>("decolorization/tanks", undefined, { enabled: session?.role === "admin" })
  const dryers = useList<Dryer>("drying/dryers", undefined, { enabled: session?.role === "admin" })
  const users = useList<UserSummary>("users/list")
  const summary = useQuery<MaintenanceSummary>({ queryKey: ["maintenance/summary"], queryFn: () => api("maintenance/summary") })

  // `mutate` functions are stable, so the table columns below can depend on them
  const { mutate: startOrder } = useAction("maintenance/work-orders", "start", { success: "Work started.", invalidate: MAINTENANCE_LISTS })
  const { mutateAsync: cancelOrder } = useAction("maintenance/work-orders", "cancel", { success: "Work order cancelled.", invalidate: MAINTENANCE_LISTS })
  const { mutate: raiseOrder } = useAction("maintenance/schedules", "create-work-order", { success: "Work order created.", invalidate: MAINTENANCE_LISTS })
  const removers = {
    machine: useDelete("maintenance/machines", { noun: "Machine", invalidate: MAINTENANCE_LISTS }),
    order: useDelete("maintenance/work-orders", { noun: "Work order", invalidate: MAINTENANCE_LISTS }),
    schedule: useDelete("maintenance/schedules", { noun: "Schedule", invalidate: MAINTENANCE_LISTS }),
    part: useDelete("maintenance/parts", { noun: "Spare part", invalidate: MAINTENANCE_LISTS }),
  }

  const machineColumns = useMemo<TableColumn<Machine>[]>(() => [
    { id: "machine", header: "Machine", accessorFn: (r) => `${r.code} ${r.name}`,
      cell: ({ row }) => (
        <span><span className="font-medium">{row.original.code}</span>
          <span className="block max-w-56 truncate text-xs text-muted-foreground">{row.original.name}</span></span>
      ) },
    { accessorKey: "category", header: "Category", cell: ({ getValue }) => getValue<string>() || dash },
    { accessorKey: "location", header: "Location", cell: ({ getValue }) => getValue<string>() || dash },
    { id: "make", header: "Make and model", accessorFn: (r) => [r.manufacturer, r.model].filter(Boolean).join(" "),
      cell: ({ getValue, row }) => getValue<string>()
        ? <span className="block max-w-56 truncate" title={row.original.specifications || undefined}>{getValue<string>()}</span> : dash },
    { id: "linked", header: "Linked to", accessorFn: (r) => r.tank_name ?? r.dryer_name ?? "",
      cell: ({ row }) => row.original.tank_name ? `Tank: ${row.original.tank_name}` : row.original.dryer_name ? `Dryer: ${row.original.dryer_name}` : dash },
    { accessorKey: "open_work_orders", header: "Open jobs", sortFn: "basic",
      cell: ({ getValue }) => <span className={cn("tabular-nums", !getValue<number>() && "text-muted-foreground")}>{getValue<number>()}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} tone={MACHINE_TONES[row.original.status]} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => admin ? <RowActions onEdit={() => setEditing({ kind: "machine", record: row.original })}
        onDelete={() => setDeleting({ kind: "machine", id: row.original.id, label: row.original.code })} /> : null },
  ], [admin])

  const orderColumns = useMemo<TableColumn<WorkOrder>[]>(() => [
    { accessorKey: "number", header: "Work order",
      cell: ({ row }) => (
        <span><span className="font-medium">{row.original.number}</span>
          <span className="block text-xs text-muted-foreground">{row.original.kind}</span></span>
      ) },
    { id: "machine", header: "Machine", accessorFn: (r) => `${r.machine_code} ${r.machine_name}`,
      cell: ({ row }) => (
        <span><span className="font-medium">{row.original.machine_code}</span>
          <span className="block max-w-44 truncate text-xs text-muted-foreground">{row.original.machine_name}</span></span>
      ) },
    { accessorKey: "title", header: "Job",
      cell: ({ row }) => (
        <span className="flex max-w-72 flex-col items-start gap-1">
          <span className="block max-w-full truncate" title={row.original.title}>{row.original.title}</span>
          {row.original.is_breakdown && <StatusBadge status="Breakdown" tone="danger" />}
        </span>
      ) },
    { accessorKey: "priority", header: "Priority", cell: ({ row }) => <StatusBadge status={row.original.priority} tone={PRIORITY_TONES[row.original.priority]} /> },
    { accessorKey: "assigned_to_name", header: "Assigned to",
      cell: ({ getValue }) => getValue<string | null>() ? <NameWithAvatar name={getValue<string>()} /> : <span className="text-muted-foreground">Nobody yet</span> },
    { id: "reported_at", header: "Reported", accessorFn: (r) => new Date(r.reported_at), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.reported_at)}</span> },
    { id: "total_cost", header: "Cost", accessorFn: (r) => Number(r.total_cost), sortFn: "basic",
      cell: ({ row }) => Number(row.original.total_cost) ? <span className="tabular-nums">{rupees(row.original.total_cost)}</span> : dash },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} tone={ORDER_TONES[row.original.status]} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const o = row.original
        const closed = o.status === "Done" || o.status === "Cancelled"
        const canWork = admin || o.assigned_to === null || o.assigned_to === myId
        const extra = [{ label: "Parts used", icon: <Cog className="size-4" />, onSelect: () => setViewingId(o.id) }]
        if (o.status === "Open" && canWork) extra.push({ label: "Start", icon: <Play className="size-4" />, onSelect: () => startOrder({ id: o.id }) })
        if (!closed && canWork) extra.push({ label: "Complete", icon: <CheckCircle2 className="size-4" />, onSelect: () => setCompleting(o) })
        if (!closed && admin) extra.push({ label: "Cancel", icon: <Ban className="size-4" />, onSelect: () => setCancelling(o) })
        // Admins change any unfinished order; the person who reported it can correct it while it is open
        const editable = !closed && (admin || (o.status === "Open" && o.reported_by === myId))
        return <RowActions extra={extra}
          onEdit={editable ? () => setEditing({ kind: "order", record: o }) : undefined}
          onDelete={admin ? () => setDeleting({ kind: "order", id: o.id, label: o.number }) : undefined} />
      } },
  ], [admin, myId, startOrder])

  const scheduleColumns = useMemo<TableColumn<MaintenanceSchedule>[]>(() => [
    { accessorKey: "task", header: "Task",
      cell: ({ row }) => <span className="block max-w-72 truncate font-medium" title={row.original.instructions || row.original.task}>{row.original.task}</span> },
    { id: "machine", header: "Machine", accessorFn: (r) => `${r.machine_code} ${r.machine_name}`,
      cell: ({ row }) => (
        <span><span className="font-medium">{row.original.machine_code}</span>
          <span className="block max-w-44 truncate text-xs text-muted-foreground">{row.original.machine_name}</span></span>
      ) },
    { accessorKey: "every_days", header: "Every", sortFn: "basic", cell: ({ getValue }) => plural(getValue<number>(), "day") },
    { id: "last_done_on", header: "Last done", accessorFn: (r) => (r.last_done_on ? new Date(r.last_done_on) : new Date(0)), sortFn: "datetime",
      cell: ({ row }) => row.original.last_done_on ? <span className="text-muted-foreground">{date(row.original.last_done_on)}</span> : <span className="text-muted-foreground">Never</span> },
    { id: "next_due_on", header: "Next due", accessorFn: (r) => new Date(r.next_due_on), sortFn: "datetime",
      cell: ({ row }) => {
        const s = row.original
        const soon = s.is_active && !s.overdue && s.days_until_due <= 7
        return (
          <span>{date(s.next_due_on)}
            {s.is_active && <span className={cn("block text-xs", s.overdue ? "font-medium text-danger-fg" : soon ? "text-warning-fg" : "text-muted-foreground")}>{dueText(s.days_until_due)}</span>}
          </span>
        )
      } },
    { id: "state", header: "Status", accessorFn: (r) => (!r.is_active ? "Not in use" : r.open_work_order ? "Work order open" : r.overdue ? "Overdue" : "On schedule"),
      cell: ({ row, getValue }) => {
        const s = row.original
        return (
          <span className="flex flex-col items-start gap-1">
            <StatusBadge status={getValue<string>()} tone={!s.is_active ? "neutral" : s.open_work_order ? "running" : s.overdue ? "danger" : "success"} />
            {s.open_work_order && <span className="text-xs text-muted-foreground">{s.open_work_order}</span>}
          </span>
        )
      } },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const s = row.original
        if (!admin) return null
        const extra = s.is_active && !s.open_work_order
          ? [{ label: "Create work order", icon: <ClipboardList className="size-4" />, onSelect: () => raiseOrder({ id: s.id }) }] : []
        return <RowActions extra={extra} onEdit={() => setEditing({ kind: "schedule", record: s })}
          onDelete={() => setDeleting({ kind: "schedule", id: s.id, label: s.task })} />
      } },
  ], [admin, raiseOrder])

  const partColumns = useMemo<TableColumn<SparePart>[]>(() => [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "name", header: "Part", cell: ({ getValue }) => <span className="block max-w-64 truncate">{getValue<string>()}</span> },
    { id: "stock_quantity", header: "In stock", accessorFn: (r) => Number(r.stock_quantity), sortFn: "basic",
      cell: ({ row }) => (
        <span className="flex flex-col items-start gap-1">
          <span className={cn("tabular-nums", row.original.low && "font-medium text-danger-fg")}>{amount(row.original.stock_quantity)} {row.original.unit}</span>
          {row.original.low && <StatusBadge status="Low stock" tone="danger" />}
        </span>
      ) },
    { id: "reorder_level", header: "Reorder at", accessorFn: (r) => Number(r.reorder_level), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{amount(row.original.reorder_level)} {row.original.unit}</span> },
    { id: "unit_cost", header: "Cost per unit", accessorFn: (r) => Number(r.unit_cost), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.unit_cost)}</span> },
    { id: "stock_value", header: "Stock value", accessorFn: (r) => Number(r.stock_value), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.stock_value)}</span> },
    { accessorKey: "location", header: "Location", cell: ({ getValue }) => getValue<string>() || dash },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => admin ? <RowActions
        extra={[{ label: "Receive", icon: <PackagePlus className="size-4" />, onSelect: () => setReceiving(row.original) }]}
        onEdit={() => setEditing({ kind: "part", record: row.original })}
        onDelete={() => setDeleting({ kind: "part", id: row.original.id, label: row.original.name })} /> : null },
  ], [admin])

  const newOrder = { label: admin ? "New work order" : "Report breakdown", open: () => setEditing({ kind: "order", record: null }) }
  const addFor: Record<Tab, { label: string; open: () => void }[]> = {
    dashboard: [newOrder],
    orders: [newOrder],
    performance: [newOrder],
    machines: admin ? [{ label: "Add machine", open: () => setEditing({ kind: "machine", record: null }) }, newOrder] : [newOrder],
    schedules: admin ? [{ label: "New schedule", open: () => setEditing({ kind: "schedule", record: null }) }, newOrder] : [newOrder],
    parts: admin ? [{ label: "Add spare part", open: () => setEditing({ kind: "part", record: null }) }, newOrder] : [newOrder],
  }

  const core = [machines, orders, summary]
  const loadError = core.find((q) => q.isError)
  const s = summary.data
  const allOrders = orders.data ?? []
  const unfinished = allOrders.filter((o) => o.status === "Open" || o.status === "In progress")
  const shownOrders = allOrders.filter((o) =>
    (statusFilter === ALL || (statusFilter === ACTIVE ? o.status === "Open" || o.status === "In progress" : o.status === statusFilter))
    && (kindFilter === ALL || o.kind === kindFilter))
  const viewing = allOrders.find((o) => o.id === viewingId) ?? null
  const count = (status: Machine["status"]) => s?.machines_by_status.find((m) => m.status === status)?.count ?? 0

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Maintenance" icon="maintenance"
        description="Machines, breakdowns and planned upkeep, with the spare parts and costs that go with them."
        actions={addFor[tab].map((a, i) => (
          <Button key={a.label} variant={i === addFor[tab].length - 1 ? "default" : "outline"} onClick={a.open}>
            {a === newOrder && !admin ? <TriangleAlert className="size-4" /> : <Plus className="size-4" />} {a.label}
          </Button>
        ))} />

      {loadError ? (
        <ErrorState message={loadError.error!.message} onRetry={() => core.forEach((q) => q.refetch())} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="machines">Machines</TabsTrigger>
            <TabsTrigger value="orders">Work orders</TabsTrigger>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
            <TabsTrigger value="parts">Spare parts</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4 space-y-6">
            {!s || !orders.data ? <CardsSkeleton /> : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Machines running" icon={Cog} tone="maintenance" value={`${count("Running")} of ${s.machines - count("Retired")}`}
                    muted={s.machines === 0}
                    hint={count("Broken down") ? `${count("Broken down")} broken down` : count("Under maintenance") ? `${count("Under maintenance")} under maintenance` : "None stopped for repair"} />
                  <StatCard label="Open work orders" icon={Wrench} tone={s.urgent_work_orders ? "danger" : "info"}
                    value={s.open_work_orders + s.in_progress_work_orders} muted={s.open_work_orders + s.in_progress_work_orders === 0}
                    hint={`${s.in_progress_work_orders} in progress${s.urgent_work_orders ? ` · ${s.urgent_work_orders} urgent` : ""}`} />
                  <StatCard label="Downtime, this month" icon={Timer} tone={s.breakdowns_this_month ? "warning" : "success"}
                    value={`${amount(s.downtime_hours_this_month)} h`} muted={!Number(s.downtime_hours_this_month)}
                    hint={plural(s.breakdowns_this_month, "breakdown")} />
                  <StatCard label="Maintenance cost, this month" icon={Coins} tone="info" value={rupees(s.cost_this_month)}
                    muted={!Number(s.cost_this_month)} hint="Labour, parts and other costs" />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="animate-rise">
                    <CardHeader>
                      <CardTitle>Work in hand</CardTitle>
                      <CardDescription className="mt-0.5">Open and in-progress work orders, newest first</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {unfinished.length ? unfinished.slice(0, 6).map((o) => (
                        <button key={o.id} type="button" onClick={() => setViewingId(o.id)}
                          className={cn("flex w-full flex-wrap items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-border-strong",
                            o.is_breakdown && "border-danger/25 bg-danger/5")}>
                          <span className="min-w-0 flex-1 basis-40">
                            <span className="block truncate text-sm font-medium">{o.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{o.number} · {o.machine_code} {o.machine_name}</span>
                          </span>
                          <StatusBadge status={o.status} tone={ORDER_TONES[o.status]} />
                        </button>
                      )) : (
                        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                          <CheckCircle2 className="size-4 text-success-fg" aria-hidden /> No work is waiting.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="animate-rise">
                    <CardHeader>
                      <CardTitle>Machines by status</CardTitle>
                      <CardDescription className="mt-0.5">{plural(s.machines, "machine")} in the register</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <SegmentedBar label="Machines by status" segments={s.machines_by_status.map((m) => ({
                        value: m.count, tone: MACHINE_TONES[m.status], label: `${m.status} ${m.count}`,
                      }))} />
                      <div>
                        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          <CalendarClock className="size-3.5" aria-hidden /> Overdue preventive work
                        </h3>
                        {s.overdue_schedules.length ? (
                          <ul className="divide-y rounded-xl border">
                            {s.overdue_schedules.slice(0, 5).map((o) => (
                              <li key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">{o.task}</span>
                                  <span className="block truncate text-xs text-muted-foreground">{o.machine_code} {o.machine_name}</span>
                                </span>
                                <span className="shrink-0 text-xs font-medium text-danger-fg">{dueText(-o.days_overdue)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : <p className="text-sm text-muted-foreground">Nothing is overdue. {plural(s.due_this_week, "task")} due in the next 7 days.</p>}
                      </div>
                      <div>
                        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Parts to reorder</h3>
                        {s.low_parts.length ? (
                          <ul className="divide-y rounded-xl border">
                            {s.low_parts.slice(0, 5).map((p) => (
                              <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                                <span className="shrink-0 text-xs text-danger-fg tabular-nums">{amount(p.stock_quantity)} {p.unit} left · reorder at {amount(p.reorder_level)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : <p className="text-sm text-muted-foreground">All parts are above their reorder level.</p>}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="machines" className="mt-4">
            {machines.isPending ? <TableSkeleton columns={8} /> : (
              <DataTable columns={machineColumns} data={machines.data ?? []} exportName="machines"
                searchPlaceholder="Search machine, category, location…" emptyTitle="No machines"
                emptyDescription={admin ? "Register one with “Add machine”." : "An admin registers the machines."} />
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            {orders.isPending ? <TableSkeleton columns={8} /> : (
              <DataTable columns={orderColumns} data={shownOrders} exportName="work-orders"
                searchPlaceholder="Search work order, machine, job…" emptyTitle="No work orders"
                emptyDescription={statusFilter === ACTIVE ? "No work is open. Change the filter to see finished work." : "Nothing matches these filters."}
                initialSorting={[{ id: "reported_at", desc: true }]}
                filters={[
                  ...(statusFilter !== ALL ? [{ label: `Status: ${statusFilter === ACTIVE ? "Not finished" : statusFilter}`, onClear: () => setStatusFilter(ALL) }] : []),
                  ...(kindFilter !== ALL ? [{ label: `Type: ${kindFilter}`, onClear: () => setKindFilter(ALL) }] : []),
                ]}
                toolbar={<>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[160px]" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All statuses</SelectItem>
                      <SelectItem value={ACTIVE}>Not finished</SelectItem>
                      {ORDER_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={kindFilter} onValueChange={setKindFilter}>
                    <SelectTrigger className="h-9 w-[150px]" aria-label="Type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All types</SelectItem>
                      {KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </>} />
            )}
          </TabsContent>

          <TabsContent value="schedules" className="mt-4">
            {schedules.isError ? <ErrorState message={schedules.error.message} onRetry={() => schedules.refetch()} />
              : schedules.isPending ? <TableSkeleton columns={6} /> : (
                <DataTable columns={scheduleColumns} data={schedules.data} exportName="maintenance-schedules"
                  searchPlaceholder="Search task or machine…" emptyTitle="No preventive schedules"
                  emptyDescription={admin ? "Plan repeated upkeep with “New schedule”." : "An admin plans the preventive work."}
                  initialSorting={[{ id: "next_due_on", desc: false }]} />
              )}
          </TabsContent>

          <TabsContent value="parts" className="mt-4">
            {parts.isError ? <ErrorState message={parts.error.message} onRetry={() => parts.refetch()} />
              : parts.isPending ? <TableSkeleton columns={7} /> : (
                <DataTable columns={partColumns} data={parts.data} exportName="spare-parts"
                  searchPlaceholder="Search code, part, location…" emptyTitle="No spare parts"
                  emptyDescription={admin ? "Add the parts kept in the store with “Add spare part”." : "An admin keeps the spare parts list."} />
              )}
          </TabsContent>

          <TabsContent value="performance" className="mt-4">
            <PerformancePanel />
          </TabsContent>
        </Tabs>
      )}

      <MachineDialog open={editing?.kind === "machine"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "machine" ? editing.record : null} tanks={tanks.data ?? []} dryers={dryers.data ?? []} />
      <WorkOrderDialog open={editing?.kind === "order"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "order" ? editing.record : null} machines={machines.data ?? []} users={users.data ?? []} admin={admin} />
      <ScheduleDialog open={editing?.kind === "schedule"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "schedule" ? editing.record : null} machines={machines.data ?? []} />
      <PartDialog open={editing?.kind === "part"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "part" ? editing.record : null} />
      <CompleteDialog order={completing} onOpenChange={(o) => !o && setCompleting(null)} />
      <ReceiveDialog part={receiving} onOpenChange={(o) => !o && setReceiving(null)} />
      <WorkOrderSheet order={viewing} onOpenChange={(o) => !o && setViewingId(null)} parts={parts.data ?? []} admin={admin}
        canWork={!!viewing && (admin || viewing.assigned_to === null || viewing.assigned_to === myId)} />

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title={`Cancel ${cancelling?.number}?`}
        description="The work order is closed without being done, and the machine goes back to its normal status. Parts already used stay on it."
        confirmLabel="Cancel work order"
        onConfirm={async () => {
          if (cancelling) await cancelOrder({ id: cancelling.id })
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.label}?`}
        description="It will be removed. Records that depend on it can't be deleted."
        onConfirm={async () => {
          if (deleting) await removers[deleting.kind].mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
