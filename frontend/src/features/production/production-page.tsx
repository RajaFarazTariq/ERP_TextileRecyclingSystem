"use client"

import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle, ArrowLeft, Ban, CalendarClock, CheckCircle2, Clock, Coins, Eye, Factory, FlaskConical, Pencil,
  PackageCheck, Play, Plus, Send, SkipForward, Timer,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { axisProps, ChartCard, ChartLegend, ChartTooltip, cursorProps, gridProps, yAxisProps } from "@/components/common/chart"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { ProgressBar } from "@/components/common/meters"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/features/auth/use-session"
import { api } from "@/lib/api"
import { useAction, useDelete, useList } from "@/lib/crud"
import { date, kg, percent, plural, rupees } from "@/lib/format"
import type { StatusTone } from "@/lib/tones"
import { cn } from "@/lib/utils"
import type {
  Bom, Chemical, FabricLot, FactoryUnit, LotActivity, MaterialRequirement, MaterialUse, OrderStep, ProcessStage,
  ProductionOrder, ProductionSummary, Routing, UserSummary,
} from "@/types/api"
import {
  AssignStepDialog, BomDialog, CompleteStepDialog, MaterialUseDialog, OrderDialog, PRODUCTION_LISTS, RoutingDialog,
  StageDialog,
} from "./production-forms"
import { ORDER_STATUSES, STAGE_MODULES, isFloorUser } from "./schemas"

type Tab = "dashboard" | "orders" | "schedule" | "materials" | "setup"
type Editing =
  | { kind: "order"; record: ProductionOrder | null }
  | { kind: "routing"; record: Routing | null }
  | { kind: "bom"; record: Bom | null }
  | { kind: "stage"; record: ProcessStage | null }
type Deleting = { kind: "order" | "routing" | "bom" | "stage"; id: number; label: string }
type Confirming = { action: "release" | "cancel" | "complete"; order: ProductionOrder }

const ALL = "all"
const DAY = 86_400_000
const n = (v: string | number | null | undefined) => Number(v) || 0
const hours = (v: string | number | null | undefined) => `${n(v).toLocaleString("en-PK", { maximumFractionDigits: 1 })} h`
const PRIORITY_TONE: Record<string, StatusTone> = { High: "danger", Normal: "neutral", Low: "info" }
const BAR_TONE: Record<string, string> = {
  Draft: "bg-faint/60", Released: "bg-info", "In Progress": "bg-running", Completed: "bg-success", Cancelled: "bg-muted",
}

function Figure({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-heading text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

/** Orders as bars on a date line, soonest first: who is running, waiting or late. */
function Schedule({ orders, onOpen }: { orders: ProductionOrder[]; onOpen: (o: ProductionOrder) => void }) {
  const shown = orders.filter((o) => o.status !== "Cancelled" && o.status !== "Completed")
    .sort((a, b) => a.planned_start.localeCompare(b.planned_start))
  if (!shown.length) {
    return <Card><CardContent><EmptyState icon={CalendarClock} title="Nothing scheduled" description="Draft, released and running orders show here on a date line." /></CardContent></Card>
  }
  const today = new Date(new Date().toDateString()).getTime()
  const start = Math.min(today, ...shown.map((o) => new Date(o.planned_start).getTime())) - DAY
  const end = Math.max(today, ...shown.map((o) => new Date(o.planned_end).getTime())) + 2 * DAY
  const span = end - start
  const pct = (t: number) => ((t - start) / span) * 100
  const days = Math.round(span / DAY)
  const ticks = Array.from({ length: Math.min(days, 8) + 1 }, (_, i) => start + Math.round((i * days) / Math.min(days, 8)) * DAY)

  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
        <CardDescription className="mt-0.5">Planned dates of open orders. The line marks today.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="scrollbar-thin overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="relative mb-2 ml-44 h-5 text-[11px] text-muted-foreground">
              {ticks.map((t) => (
                <span key={t} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(t)}%` }}>
                  {new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              ))}
            </div>
            <ul className="space-y-1.5">
              {shown.map((o) => (
                <li key={o.id} className="flex items-center gap-3">
                  <button type="button" onClick={() => onOpen(o)} className="w-41 shrink-0 truncate rounded text-left text-sm hover:text-brand-text"
                    title={`${o.number} · ${o.product_name}`}>
                    <span className="font-medium">{o.number}</span> <span className="text-muted-foreground">{o.product_name}</span>
                  </button>
                  <div className="relative h-7 flex-1 rounded-md bg-muted/50">
                    <span aria-hidden className="absolute inset-y-0 w-px bg-brand" style={{ left: `${pct(today)}%` }} />
                    <button type="button" onClick={() => onOpen(o)}
                      aria-label={`${o.number}: ${date(o.planned_start)} to ${date(o.planned_end)}, ${o.status}${o.is_late ? ", late" : ""}`}
                      className={cn("absolute inset-y-1 flex items-center overflow-hidden rounded px-2 text-[11px] font-medium text-white",
                        BAR_TONE[o.status], o.is_late && "ring-2 ring-danger")}
                      style={{ left: `${pct(new Date(o.planned_start).getTime())}%`, width: `${Math.max(pct(new Date(o.planned_end).getTime() + DAY) - pct(new Date(o.planned_start).getTime()), 1.5)}%` }}>
                      <span className="truncate">{o.progress_pct > 0 ? `${o.progress_pct}%` : o.status}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4">
          <ChartLegend items={[
            { label: "Draft", color: "var(--faint)" }, { label: "Released", color: "var(--info)" },
            { label: "In progress", color: "var(--running)" }, { label: "Late (red outline)", color: "var(--danger)" },
          ]} />
        </div>
      </CardContent>
    </Card>
  )
}

/** One order: its stages, materials, costs and the lot's sessions. */
function OrderDetail({ order, admin, floor, users, onBack, onEdit, onConfirm }: {
  order: ProductionOrder
  admin: boolean
  floor: boolean
  users: UserSummary[]
  onBack: () => void
  onEdit: () => void
  onConfirm: (c: Confirming) => void
}) {
  const [completing, setCompleting] = useState<OrderStep | null>(null)
  const [assigning, setAssigning] = useState<OrderStep | null>(null)
  const [recording, setRecording] = useState<MaterialUse | null>(null)
  const { mutate: startStep, isPending: starting } = useAction("production/steps", "start", { success: "Step started.", invalidate: PRODUCTION_LISTS })
  const { mutate: skipStep } = useAction("production/steps", "skip", { success: "Step skipped.", invalidate: PRODUCTION_LISTS })
  const activity = useQuery<LotActivity[]>({
    queryKey: ["production/orders", order.id, "activity"], queryFn: () => api(`production/orders/${order.id}/activity`),
  })

  const open = order.status === "Released" || order.status === "In Progress"
  const next = order.steps.find((s) => s.status === "In Progress") ?? order.steps.find((s) => s.status === "Pending")
  const allClosed = order.steps.every((s) => s.status === "Done" || s.status === "Skipped")
  // What came out of the last finished stage goes into the next one
  const lastOutput = [...order.steps].reverse().find((s) => s.status === "Done")?.output_kg ?? order.planned_input_kg

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> All orders</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {order.status === "Draft" && admin && <Button size="sm" onClick={() => onConfirm({ action: "release", order })}><Send className="size-4" /> Release</Button>}
          {order.status === "In Progress" && floor && allClosed && (
            <Button size="sm" onClick={() => onConfirm({ action: "complete", order })}><PackageCheck className="size-4" /> Complete order</Button>
          )}
          {admin && order.status !== "Completed" && order.status !== "Cancelled" && (
            <>
              <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="size-4" /> Edit</Button>
              <Button size="sm" variant="outline" onClick={() => onConfirm({ action: "cancel", order })}><Ban className="size-4" /> Cancel order</Button>
            </>
          )}
        </div>
      </div>

      <Card className="animate-rise">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {order.number} <StatusBadge status={order.status} />
              {order.priority !== "Normal" && <StatusBadge status={`${order.priority} priority`} tone={PRIORITY_TONE[order.priority]} />}
              {order.is_late && <StatusBadge status="Late" tone="danger" />}
            </CardTitle>
            <CardDescription className="mt-1">
              {order.product_name} · lot #{order.fabric} {order.fabric_material} · {order.routing_name}
              {order.unit_name && ` · ${order.unit_name}`}
            </CardDescription>
          </div>
          <p className="text-sm text-muted-foreground">{date(order.planned_start)} – {date(order.planned_end)}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>{order.current_stage ? `Now: ${order.current_stage}` : order.status}</span>
              <span>{order.progress_pct}% of stages done</span>
            </div>
            <ProgressBar value={order.progress_pct} tone={order.status === "Completed" ? "success" : "production"} label={`${order.number} progress`} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Figure label="Input" value={kg(order.actual_input_kg ?? order.planned_input_kg)}
              sub={order.actual_input_kg ? `planned ${kg(order.planned_input_kg)}` : "planned"} />
            <Figure label="Output" value={order.output_kg ? kg(order.output_kg) : "—"}
              sub={`planned ${kg(order.planned_output_kg)}${order.yield_pct != null ? ` · ${percent(order.yield_pct)} yield` : ""}`} />
            <Figure label="Time" value={hours(order.actual_hours)} sub={`planned ${hours(order.planned_hours)} · waste ${kg(order.waste_kg)}`} />
            <Figure label="Cost" value={rupees(order.total_cost)}
              sub={`planned ${rupees(order.planned_cost)}${order.cost_per_kg ? ` · ${rupees(order.cost_per_kg)}/kg` : ""}`} />
          </div>
          {order.notes && <p className="text-sm text-muted-foreground">{order.notes}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="animate-rise xl:col-span-3">
          <CardHeader>
            <CardTitle>Stages</CardTitle>
            <CardDescription className="mt-0.5">
              {order.status === "Draft" ? "Release the order to start work." : "Stages run in order; record what went in and came out of each."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {order.steps.map((s) => (
                <li key={s.id} className={cn("rounded-xl border p-3", s.status === "In Progress" && "border-running/40 bg-running/5")}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{s.sequence}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.stage_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[s.operator_name, s.machine, `${hours(s.actual_hours ?? s.planned_hours)}${s.actual_hours ? ` of ${hours(s.planned_hours)} planned` : " planned"}`]
                          .filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <StatusBadge status={s.status} />
                    <span className="flex gap-1.5">
                      {open && floor && s.status === "Pending" && s.id === next?.id && (
                        <Button size="sm" disabled={starting} onClick={() => startStep({ id: s.id })}><Play className="size-3.5" /> Start</Button>
                      )}
                      {open && floor && s.status === "In Progress" && (
                        <Button size="sm" onClick={() => setCompleting(s)}><CheckCircle2 className="size-3.5" /> Complete</Button>
                      )}
                      {admin && open && (s.status === "Pending" || s.status === "In Progress") && (
                        <Button size="sm" variant="outline" aria-label={`Skip ${s.stage_name}`} title="Skip this stage" onClick={() => skipStep({ id: s.id })}>
                          <SkipForward className="size-3.5" />
                        </Button>
                      )}
                      {admin && order.status !== "Completed" && order.status !== "Cancelled" && (
                        <Button size="sm" variant="outline" aria-label={`Plan ${s.stage_name}`} title="Operator, machine, hours and cost" onClick={() => setAssigning(s)}>
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                    </span>
                  </div>
                  {s.status === "Done" && (
                    <p className="mt-2 pl-9 text-xs text-muted-foreground">
                      {kg(s.input_kg)} in → <span className="font-medium text-foreground">{kg(s.output_kg)} out</span> · {kg(s.waste_kg)} waste
                      {n(s.cost) > 0 && ` · ${rupees(s.cost)}`}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          <Card className="animate-rise">
            <CardHeader>
              <CardTitle>Materials</CardTitle>
              <CardDescription className="mt-0.5">Planned from the bill of materials, against what was used</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.materials.length ? order.materials.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.material}</span>
                    <span className="block text-xs text-muted-foreground">
                      {m.actual_quantity != null ? `${n(m.actual_quantity)} of ` : ""}{n(m.planned_quantity)} {m.unit} planned
                      {n(m.unit_cost) > 0 && ` · ${rupees(m.actual_cost ?? m.planned_cost)}`}
                    </span>
                  </span>
                  {floor && order.status !== "Completed" && order.status !== "Cancelled" && order.status !== "Draft" && (
                    <Button size="sm" variant="outline" onClick={() => setRecording(m)}>{m.actual_quantity != null ? "Change" : "Record use"}</Button>
                  )}
                </div>
              )) : <p className="py-2 text-sm text-muted-foreground">No bill of materials on this order.</p>}
            </CardContent>
          </Card>

          <Card className="animate-rise">
            <CardHeader>
              <CardTitle>Lot activity</CardTitle>
              <CardDescription className="mt-0.5">Sorting, decolorization and drying sessions of lot #{order.fabric}</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.data?.length ? (
                <ul className="divide-y text-sm">
                  {activity.data.slice(0, 8).map((a) => (
                    <li key={`${a.module}-${a.id}`} className="flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium capitalize">{a.module} #{a.id}</span>
                        <span className="block truncate text-xs text-muted-foreground">{date(a.date)} · {a.supervisor} · {kg(a.input_kg)} in, {kg(a.output_kg)} out</span>
                      </span>
                      <StatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              ) : <p className="py-2 text-sm text-muted-foreground">{activity.isPending ? "Loading…" : "No sessions for this lot yet."}</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <CompleteStepDialog step={completing} suggestedInput={lastOutput} onOpenChange={(o) => !o && setCompleting(null)} />
      <AssignStepDialog step={assigning} users={users} onOpenChange={(o) => !o && setAssigning(null)} />
      <MaterialUseDialog material={recording} onOpenChange={(o) => !o && setRecording(null)} />
    </div>
  )
}

export function ProductionPage() {
  const role = useSession().data?.role
  const admin = role === "admin"
  const floor = isFloorUser(role)
  const [tab, setTab] = useState<Tab>("dashboard")
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [selected, setSelected] = useState<number | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const [confirming, setConfirming] = useState<Confirming | null>(null)

  const orders = useList<ProductionOrder>("production/orders")
  const routings = useList<Routing>("production/routings")
  const boms = useList<Bom>("production/boms")
  const stages = useList<ProcessStage>("production/stages")
  const lots = useList<FabricLot>("sorting/fabric-stock")
  const units = useList<FactoryUnit>("warehouse/units")
  const chemicals = useList<Chemical>("decolorization/chemicals")
  const users = useList<UserSummary>("users/list")
  const summary = useQuery<ProductionSummary>({ queryKey: ["production/summary"], queryFn: () => api("production/summary") })
  const requirements = useQuery<MaterialRequirement[]>({ queryKey: ["production/requirements"], queryFn: () => api("production/requirements") })

  const actions = {
    release: useAction("production/orders", "release", { success: "Order released to the floor.", invalidate: PRODUCTION_LISTS }),
    cancel: useAction("production/orders", "cancel", { success: "Order cancelled.", invalidate: PRODUCTION_LISTS }),
    complete: useAction("production/orders", "complete", { success: "Order completed.", invalidate: PRODUCTION_LISTS }),
  }
  const removers = {
    order: useDelete("production/orders", { noun: "Production order", invalidate: PRODUCTION_LISTS }),
    routing: useDelete("production/routings", { noun: "Routing", invalidate: PRODUCTION_LISTS }),
    bom: useDelete("production/boms", { noun: "Bill of materials", invalidate: PRODUCTION_LISTS }),
    stage: useDelete("production/stages", { noun: "Stage", invalidate: PRODUCTION_LISTS }),
  }

  const openOrder = (o: ProductionOrder) => {
    setSelected(o.id)
    setTab("orders")
  }

  const orderColumns = useMemo<TableColumn<ProductionOrder>[]>(() => [
    { accessorKey: "number", header: "Order",
      cell: ({ row }) => (
        <button type="button" className="text-left hover:text-brand-text" onClick={() => setSelected(row.original.id)}>
          <span className="font-medium">{row.original.number}</span>
          {row.original.priority === "High" && <span className="ml-1.5 rounded bg-danger/15 px-1 py-0.5 text-[10px] font-semibold text-danger-fg">High</span>}
        </button>
      ) },
    { accessorKey: "product_name", header: "Product",
      cell: ({ row }) => <span>{row.original.product_name}<span className="block text-xs text-muted-foreground">Lot #{row.original.fabric} · {row.original.fabric_material}</span></span> },
    { id: "planned_input", header: "Input", accessorFn: (r) => n(r.planned_input_kg), sortFn: "basic", cell: ({ row }) => kg(row.original.planned_input_kg) },
    { id: "planned_start", header: "Planned", accessorFn: (r) => new Date(r.planned_start), sortFn: "datetime",
      cell: ({ row }) => (
        <span className={cn("inline-flex items-center gap-1", row.original.is_late ? "font-medium text-danger-fg" : "text-muted-foreground")}>
          {row.original.is_late && <AlertTriangle className="size-3.5" aria-label="Late" />}
          {date(row.original.planned_start)} – {date(row.original.planned_end)}
        </span>
      ) },
    { id: "progress", header: "Progress", accessorFn: (r) => r.progress_pct, sortFn: "basic",
      cell: ({ row }) => (
        <div className="ml-auto min-w-32 space-y-1.5 text-left">
          <ProgressBar value={row.original.progress_pct} size="sm" tone={row.original.status === "Completed" ? "success" : "production"} label={`${row.original.number} progress`} />
          <p className="text-xs text-muted-foreground">{row.original.current_stage ?? `${row.original.progress_pct}%`}</p>
        </div>
      ) },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const o = row.original
        const extra = [{ label: "Open", icon: <Eye className="size-4" />, onSelect: () => setSelected(o.id) }]
        if (o.status === "Draft" && admin) extra.push({ label: "Release", icon: <Send className="size-4" />, onSelect: () => setConfirming({ action: "release", order: o }) })
        if (admin && ["Draft", "Released", "In Progress"].includes(o.status)) extra.push({ label: "Cancel order", icon: <Ban className="size-4" />, onSelect: () => setConfirming({ action: "cancel", order: o }) })
        return <RowActions extra={extra}
          onEdit={admin && o.status !== "Completed" && o.status !== "Cancelled" ? () => setEditing({ kind: "order", record: o }) : undefined}
          onDelete={admin && (o.status === "Draft" || o.status === "Cancelled") ? () => setDeleting({ kind: "order", id: o.id, label: o.number }) : undefined} />
      } },
  ], [admin])

  const requirementColumns = useMemo<TableColumn<MaterialRequirement>[]>(() => [
    { accessorKey: "material", header: "Material", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "required", header: "Still needed", accessorFn: (r) => n(r.required), sortFn: "basic", cell: ({ row }) => `${n(row.original.required).toLocaleString()} ${row.original.unit}` },
    { id: "in_stock", header: "In stock", accessorFn: (r) => (r.in_stock == null ? -1 : n(r.in_stock)), sortFn: "basic",
      cell: ({ row }) => row.original.in_stock == null ? <span className="text-muted-foreground" title="Not a stocked chemical">—</span> : `${n(row.original.in_stock).toLocaleString()} ${row.original.unit}` },
    { id: "shortage", header: "Short by", accessorFn: (r) => n(r.shortage), sortFn: "basic",
      cell: ({ row }) => n(row.original.shortage) > 0
        ? <span className="font-semibold text-danger-fg">{n(row.original.shortage).toLocaleString()} {row.original.unit}</span>
        : <span className="text-success-fg">{row.original.in_stock == null ? "—" : "Covered"}</span> },
    { id: "orders", header: "For orders", accessorFn: (r) => r.orders.join(", "), enableSorting: false,
      cell: ({ row }) => <span className="block max-w-64 truncate text-muted-foreground" title={row.original.orders.join(", ")}>{row.original.orders.join(", ")}</span> },
  ], [])

  const routingColumns = useMemo<TableColumn<Routing>[]>(() => [
    { accessorKey: "name", header: "Routing", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "steps", header: "Stages", accessorFn: (r) => r.steps.map((s) => s.stage_name).join(" → "), enableSorting: false,
      cell: ({ row }) => <span className="block max-w-96 truncate" title={row.original.steps.map((s) => s.stage_name).join(" → ")}>{row.original.steps.map((s) => s.stage_name).join(" → ")}</span> },
    { id: "hours", header: "Planned time", accessorFn: (r) => n(r.planned_hours), sortFn: "basic", cell: ({ row }) => hours(row.original.planned_hours) },
    { accessorKey: "orders", header: "Orders", sortFn: "basic" },
    { id: "is_active", header: "Status", accessorFn: (r) => (r.is_active ? "In use" : "Not in use"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "In use" : "Not in use"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => admin ? <RowActions onEdit={() => setEditing({ kind: "routing", record: row.original })}
        onDelete={() => setDeleting({ kind: "routing", id: row.original.id, label: row.original.name })} /> : null },
  ], [admin])

  const bomColumns = useMemo<TableColumn<Bom>[]>(() => [
    { accessorKey: "name", header: "Bill of materials", cell: ({ row }) => (
      <span><span className="font-medium">{row.original.name}</span>
        {row.original.product_name && <span className="block text-xs text-muted-foreground">{row.original.product_name}</span>}</span>
    ) },
    { id: "lines", header: "Per 100 kg of input", accessorFn: (r) => r.lines.map((l) => l.material).join(", "), enableSorting: false,
      cell: ({ row }) => {
        const text = row.original.lines.map((l) => `${l.material} ${n(l.quantity_per_100kg)} ${l.unit}`).join(", ")
        return <span className="block max-w-96 truncate" title={text}>{text}</span>
      } },
    { accessorKey: "orders", header: "Orders", sortFn: "basic" },
    { id: "is_active", header: "Status", accessorFn: (r) => (r.is_active ? "In use" : "Not in use"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "In use" : "Not in use"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => admin ? <RowActions onEdit={() => setEditing({ kind: "bom", record: row.original })}
        onDelete={() => setDeleting({ kind: "bom", id: row.original.id, label: row.original.name })} /> : null },
  ], [admin])

  const stageColumns = useMemo<TableColumn<ProcessStage>[]>(() => [
    { accessorKey: "sequence", header: "Position", sortFn: "basic" },
    { accessorKey: "name", header: "Stage", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "module", header: "Done in", accessorFn: (r) => STAGE_MODULES.find((m) => m.value === r.module)?.label ?? "",
      cell: ({ row }) => row.original.module ? STAGE_MODULES.find((m) => m.value === row.original.module)?.label : <span className="text-muted-foreground">—</span> },
    { id: "is_active", header: "Status", accessorFn: (r) => (r.is_active ? "In use" : "Not in use"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "In use" : "Not in use"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => admin ? <RowActions onEdit={() => setEditing({ kind: "stage", record: row.original })}
        onDelete={() => setDeleting({ kind: "stage", id: row.original.id, label: row.original.name })} /> : null },
  ], [admin])

  const core = [orders, summary]
  const loadError = core.find((q) => q.isError)
  const s = summary.data
  const current = selected != null ? orders.data?.find((o) => o.id === selected) : undefined
  const running = (orders.data ?? []).filter((o) => o.status === "In Progress")
  const shortages = (requirements.data ?? []).filter((r) => n(r.shortage) > 0)
  const stageHours = (s?.stages ?? []).map((st) => ({ stage: st.stage, Planned: n(st.planned_hours), Actual: n(st.actual_hours) }))
  const CONFIRM_TEXT = {
    release: { title: "Release", description: "The order goes to the floor: supervisors can start its stages, and its plan can no longer change.", label: "Release" },
    cancel: { title: "Cancel", description: "Work on the order stops. It stays on record as cancelled.", label: "Cancel order" },
    complete: { title: "Complete", description: "The output of the last stage becomes the order's output, and its cost is final. Sellable stock still comes from completed drying sessions.", label: "Complete order" },
  }

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Production" icon="production"
        description="Production orders with planned against actual output, time, materials and cost."
        actions={admin && (tab === "setup"
          ? <Button onClick={() => setEditing({ kind: "routing", record: null })}><Plus className="size-4" /> New routing</Button>
          : <Button onClick={() => setEditing({ kind: "order", record: null })}><Plus className="size-4" /> New order</Button>)} />

      {loadError ? (
        <ErrorState message={loadError.error!.message} onRetry={() => core.forEach((q) => q.refetch())} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setSelected(null) }}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="setup">Setup</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4 space-y-6">
            {!s || !orders.data ? <CardsSkeleton /> : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="In progress" icon={Factory} tone="production" value={s.in_progress}
                    hint={`${kg(s.wip_kg)} being processed`} muted={s.in_progress === 0} />
                  <StatCard label="Waiting to start" icon={Clock} tone="info" value={s.released}
                    hint={`${plural(s.draft, "draft")} to release`} muted={s.released === 0} />
                  <StatCard label="Late" icon={CalendarClock} tone={s.late ? "danger" : "success"} value={s.late}
                    hint="Past the planned end date" muted={s.late === 0} />
                  <StatCard label="Completed, this month" icon={PackageCheck} tone="success" value={s.completed_this_month}
                    hint={`${kg(s.output_this_month)} produced`} muted={s.completed_this_month === 0} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard label="Yield, completed orders" icon={Timer} tone="quality" value={s.yield_pct == null ? "—" : percent(s.yield_pct)}
                    hint={`${kg(s.actual_output_completed)} out of ${kg(s.planned_output_completed)} planned · ${kg(s.waste_kg)} waste`} muted={s.yield_pct == null} />
                  <StatCard label="Cost per kg" icon={Coins} tone="warning" value={s.cost_per_kg == null ? "—" : rupees(s.cost_per_kg)}
                    hint={`${rupees(s.actual_cost_completed)} spent, ${rupees(s.planned_cost_completed)} planned`} muted={s.cost_per_kg == null} />
                  <StatCard label="Material shortages" icon={FlaskConical} tone={shortages.length ? "danger" : "success"} value={shortages.length}
                    hint={shortages.length ? shortages.slice(0, 2).map((r) => r.material).join(", ") : "Open orders are covered"} muted={shortages.length === 0} />
                </div>

                <div className="grid gap-4 lg:grid-cols-5">
                  <Card className="animate-rise lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Work in progress</CardTitle>
                      <CardDescription className="mt-0.5">Orders on the floor and the stage they are at</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {running.length ? running.slice(0, 6).map((o) => (
                        <button key={o.id} type="button" onClick={() => openOrder(o)} className="block w-full rounded-lg border p-3 text-left transition-colors hover:border-border-strong">
                          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                            <span className="truncate"><span className="font-medium">{o.number}</span> <span className="text-muted-foreground">{o.product_name}</span></span>
                            <span className={cn("shrink-0 text-xs", o.is_late ? "font-semibold text-danger-fg" : "text-muted-foreground")}>
                              {o.is_late ? "late" : `due ${date(o.planned_end)}`}
                            </span>
                          </div>
                          <ProgressBar value={o.progress_pct} size="sm" tone="production" label={`${o.number} progress`} />
                          <p className="mt-1 text-xs text-muted-foreground">{o.current_stage ?? "All stages done: ready to complete"}</p>
                        </button>
                      )) : <EmptyState icon={Factory} title="Nothing on the floor" description="Released orders show here once their first stage starts." />}
                    </CardContent>
                  </Card>

                  <ChartCard className="lg:col-span-3" title="Time per stage" description="Planned against actual hours of finished stages" contentClassName="h-64"
                    actions={<ChartLegend items={[{ label: "Planned", color: "var(--faint)" }, { label: "Actual", color: "var(--stage-production)" }]} />}>
                    {stageHours.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stageHours} margin={{ left: 0, right: 8, top: 8 }}>
                          <CartesianGrid {...gridProps} />
                          <XAxis dataKey="stage" {...axisProps} />
                          <YAxis {...yAxisProps} />
                          <Tooltip cursor={cursorProps} content={<ChartTooltip format={(v) => hours(v)} />} />
                          <Bar dataKey="Planned" isAnimationActive={false} fill="var(--faint)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                          <Bar dataKey="Actual" isAnimationActive={false} fill="var(--stage-production)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyState icon={Timer} title="No finished stages yet" description="Completed stages show their planned and actual hours here." />}
                  </ChartCard>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            {orders.isPending ? <TableSkeleton columns={7} /> : current ? (
              <OrderDetail order={current} admin={admin} floor={floor} users={users.data ?? []}
                onBack={() => setSelected(null)} onEdit={() => setEditing({ kind: "order", record: current })} onConfirm={setConfirming} />
            ) : (
              <DataTable columns={orderColumns} exportName="production-orders"
                data={(orders.data ?? []).filter((o) => statusFilter === ALL || o.status === statusFilter)}
                searchPlaceholder="Search order, product, material…" emptyTitle="No production orders"
                emptyDescription={admin ? "Plan one with “New order”." : "Orders planned by an admin show here."}
                filters={statusFilter !== ALL ? [{ label: `Status: ${statusFilter}`, onClear: () => setStatusFilter(ALL) }] : []}
                toolbar={
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[160px]" aria-label="Order status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All statuses</SelectItem>
                      {ORDER_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                    </SelectContent>
                  </Select>
                } />
            )}
          </TabsContent>

          <TabsContent value="schedule" className="mt-4">
            {orders.isPending ? <CardsSkeleton count={1} /> : <Schedule orders={orders.data ?? []} onOpen={openOrder} />}
          </TabsContent>

          <TabsContent value="materials" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">What open orders still need, from their bills of materials, against the chemical stock on hand.</p>
            {requirements.isError ? <ErrorState message={requirements.error.message} onRetry={() => requirements.refetch()} />
              : requirements.isPending ? <TableSkeleton columns={5} /> : (
                <DataTable columns={requirementColumns} data={requirements.data} exportName="material-requirements"
                  searchPlaceholder="Search material, order…" emptyTitle="No material needs"
                  emptyDescription="Open orders with a bill of materials show what they need here." />
              )}
          </TabsContent>

          <TabsContent value="setup" className="mt-4 space-y-8">
            <section className="space-y-3">
              <h2 className="font-heading text-base font-semibold">Routings</h2>
              {routings.isPending ? <TableSkeleton columns={5} /> : (
                <DataTable columns={routingColumns} data={routings.data ?? []} pageSize={10} emptyTitle="No routings"
                  emptyDescription="A routing lists the stages an order goes through." />
              )}
            </section>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-base font-semibold">Bills of materials</h2>
                {admin && <Button variant="outline" size="sm" onClick={() => setEditing({ kind: "bom", record: null })}><Plus className="size-4" /> New bill of materials</Button>}
              </div>
              {boms.isPending ? <TableSkeleton columns={4} /> : (
                <DataTable columns={bomColumns} data={boms.data ?? []} pageSize={10} emptyTitle="No bills of materials"
                  emptyDescription="List what 100 kg of input needs, so orders can plan chemicals and cost." />
              )}
            </section>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-base font-semibold">Process stages</h2>
                {admin && <Button variant="outline" size="sm" onClick={() => setEditing({ kind: "stage", record: null })}><Plus className="size-4" /> New stage</Button>}
              </div>
              {stages.isPending ? <TableSkeleton columns={4} /> : (
                <DataTable columns={stageColumns} data={stages.data ?? []} pageSize={10} emptyTitle="No stages" initialSorting={[{ id: "sequence", desc: false }]} />
              )}
            </section>
          </TabsContent>
        </Tabs>
      )}

      <OrderDialog open={editing?.kind === "order"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "order" ? editing.record : null}
        lots={lots.data ?? []} routings={routings.data ?? []} boms={boms.data ?? []} units={units.data ?? []} />
      <RoutingDialog open={editing?.kind === "routing"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "routing" ? editing.record : null} stages={stages.data ?? []} />
      <BomDialog open={editing?.kind === "bom"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "bom" ? editing.record : null} chemicals={chemicals.data ?? []} />
      <StageDialog open={editing?.kind === "stage"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "stage" ? editing.record : null} />

      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={confirming ? `${CONFIRM_TEXT[confirming.action].title} ${confirming.order.number}?` : ""}
        description={confirming ? CONFIRM_TEXT[confirming.action].description : ""}
        confirmLabel={confirming ? CONFIRM_TEXT[confirming.action].label : undefined}
        onConfirm={async () => {
          if (confirming) await actions[confirming.action].mutateAsync({ id: confirming.order.id })
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.label}?`}
        description="It will be removed. Records that depend on it can't be deleted."
        onConfirm={async () => {
          if (deleting) {
            await removers[deleting.kind].mutateAsync(deleting.id)
            if (deleting.kind === "order") setSelected(null)
          }
        }}
      />
    </div>
  )
}
