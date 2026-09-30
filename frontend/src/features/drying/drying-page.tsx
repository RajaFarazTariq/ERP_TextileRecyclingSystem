"use client"

import { CheckCircle2, Fan, Flame, ListChecks, PackageCheck, Play, Plus, Power, Scale, Trash2, Wrench } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { NameWithAvatar } from "@/components/common/identity"
import { MachineCard } from "@/components/common/machine-card"
import { FlowBar } from "@/components/common/meters"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states"
import { SectionTitle } from "@/components/common/section-title"
import { RateCard, StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAction, useDelete, useList } from "@/lib/crud"
import { kg, plural } from "@/lib/format"
import type { DecolorDoneOption, Dryer, DryingSession, FabricReadyOption, UserSummary } from "@/types/api"
import { CompleteDialog, DryerDialog, SessionDialog } from "./drying-forms"
import { DRYER_STATUSES, SESSION_STATUSES } from "./schemas"

type Tab = "dashboard" | "sessions" | "dryers"
type Editing = { kind: "session"; record: DryingSession | null } | { kind: "dryer"; record: Dryer | null }
type Deleting = { kind: "session" | "dryer"; id: number; label: string }

const ALL = "all"
const n = (v: string | number | null | undefined) => Number(v) || 0

function StatusSelect({ value, onChange, statuses, label }: { value: string; onChange: (v: string) => void; statuses: readonly string[]; label: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[150px]" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All statuses</SelectItem>
        {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function DryingDashboard({ sessions, dryers }: { sessions: DryingSession[]; dryers: Dryer[] }) {
  if (!sessions.length && !dryers.length) {
    return <EmptyState title="No drying data yet" description="Add a dryer and a drying session to see figures here." />
  }
  const completed = sessions.filter((s) => s.status === "Completed")
  const active = sessions.filter((s) => s.status === "In Progress")
  const completedInput = completed.reduce((a, s) => a + n(s.input_quantity), 0)
  const completedOutput = completed.reduce((a, s) => a + n(s.output_quantity), 0)
  const completedWaste = completed.reduce((a, s) => a + n(s.waste_quantity), 0)
  const moisture = completed.reduce((a, s) => a + n(s.moisture_loss_kg), 0)
  const runningDryers = dryers.filter((d) => d.status === "Running").length
  // The batch in each dryer right now (latest session in progress)
  const batchIn = (dryerId: number) =>
    active.filter((s) => s.dryer === dryerId).sort((x, y) => new Date(y.start_date ?? 0).getTime() - new Date(x.start_date ?? 0).getTime())[0]

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionTitle>Throughput</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Sessions" icon={ListChecks} tone="drying" value={sessions.length} hint={`${completed.length} completed`} />
          <StatCard label="Active sessions" icon={Flame} tone="running" value={active.length} hint={`${plural(runningDryers, "dryer")} running`} />
          <StatCard label="Dryers available" icon={Fan} tone="success" value={`${dryers.filter((d) => d.status === "Available").length} / ${dryers.length}`} hint="Ready for a new batch" />
          <StatCard label="Total input" icon={Scale} tone="drying" value={kg(sessions.reduce((a, s) => a + n(s.input_quantity), 0))} hint="Wet fabric from decolorization" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Output</SectionTitle>
        <div className="grid gap-4 md:grid-cols-3">
          <RateCard label="Output efficiency" percent={completedInput ? (completedOutput / completedInput) * 100 : 0} tone="success" hint="Output ÷ input, completed sessions" />
          <StatCard label="Total dried output" icon={PackageCheck} tone="sales" value={kg(sessions.reduce((a, s) => a + n(s.output_quantity), 0))} hint="Becomes sellable stock" />
          <StatCard label="Total waste" icon={Trash2} tone="danger" value={kg(sessions.reduce((a, s) => a + n(s.waste_quantity), 0))} hint="Damaged or discarded while drying" />
        </div>
        <Card className="animate-rise">
          <CardHeader>
            <CardTitle>Where the wet fabric went</CardTitle>
            <CardDescription className="mt-0.5">Completed sessions · {kg(completedInput)} in</CardDescription>
          </CardHeader>
          <CardContent>
            <FlowBar input={completedInput} label="Dried output, waste and moisture share of completed input" parts={[
              { value: completedOutput, tone: "success", label: "Dried output" },
              { value: completedWaste, tone: "danger", label: "Waste" },
              { value: moisture, tone: "info", label: "Moisture lost" },
            ]} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>Dryers</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {dryers.map((d) => {
            const batch = batchIn(d.id)
            return (
              <MachineCard
                key={d.id}
                name={d.name}
                subtitle={`${d.dryer_type} · ${kg(d.capacity)}`}
                status={d.status}
                icon={Fan}
                tone="drying"
                load={batch ? n(batch.input_quantity) : d.status === "Running" ? undefined : 0}
                capacity={n(d.capacity)}
                loadLabel={`${d.name} load`}
                runningSince={batch?.start_date}
                detail={batch ? `${batch.fabric_material}${batch.temperature_celsius ? ` · ${n(batch.temperature_celsius)} °C` : ""}` : d.status === "Maintenance" ? "Under maintenance" : "No batch loaded"}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

export function DryingPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [sessionStatus, setSessionStatus] = useState(ALL)
  const [dryerStatus, setDryerStatus] = useState(ALL)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [completing, setCompleting] = useState<DryingSession | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)

  const sessions = useList<DryingSession>("drying/sessions")
  const dryers = useList<Dryer>("drying/dryers")
  const fabrics = useList<FabricReadyOption>("drying/fabric-ready")
  const decolorDone = useList<DecolorDoneOption>("drying/decolor-sessions-done")
  const users = useList<UserSummary>("users/list")

  // `mutate` functions are stable, so the table columns below can depend on them
  const { mutate: startSession } = useAction("drying/sessions", "start", { success: "Drying started.", invalidate: [["drying/dryers"]] })
  const { mutate: markAvailable } = useAction("drying/dryers", "set_available", { success: "Dryer marked available." })
  const { mutate: sendToMaintenance } = useAction("drying/dryers", "set_maintenance", { success: "Dryer sent to maintenance." })

  const removers = {
    session: useDelete("drying/sessions", { noun: "Drying session", invalidate: [["drying/decolor-sessions-done"]] }),
    dryer: useDelete("drying/dryers", { noun: "Dryer" }),
  }

  const sessionColumns = useMemo<TableColumn<DryingSession>[]>(() => [
    { accessorKey: "id", header: "#", cell: ({ getValue }) => <span className="text-muted-foreground">#{getValue<number>()}</span> },
    { accessorKey: "dryer_name", header: "Dryer", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "fabric_material", header: "Fabric" },
    { accessorKey: "supervisor_name", header: "Supervisor", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { id: "input", header: "Input", accessorFn: (r) => n(r.input_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.input_quantity)}</span> },
    { id: "output", header: "Output", accessorFn: (r) => n(r.output_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.output_quantity)}</span> },
    { id: "waste", header: "Waste", accessorFn: (r) => n(r.waste_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.waste_quantity)}</span> },
    { id: "efficiency", header: "Efficiency", accessorFn: (r) => r.output_efficiency, sortFn: "basic",
      cell: ({ row }) => row.original.status === "Completed" ? <span className="tabular-nums">{row.original.output_efficiency.toFixed(1)}%</span> : <span className="text-muted-foreground">—</span> },
    { id: "temperature", header: "Temp", accessorFn: (r) => n(r.temperature_celsius), sortFn: "basic",
      cell: ({ row }) => row.original.temperature_celsius ? `${n(row.original.temperature_celsius)} °C` : "—" },
    { id: "duration", header: "Duration", accessorFn: (r) => r.duration_minutes ?? 0, sortFn: "basic",
      cell: ({ row }) => row.original.duration_minutes ? `${row.original.duration_minutes} min` : "—" },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const s = row.original
        const extra = []
        if (s.status === "Pending" || s.status === "On Hold") {
          extra.push({ label: "Start", icon: <Play className="size-4" />, onSelect: () => startSession({ id: s.id }) })
        }
        if (s.status !== "Completed") {
          extra.push({ label: "Complete", icon: <CheckCircle2 className="size-4" />, onSelect: () => setCompleting(s) })
        }
        return (
          <RowActions extra={extra} onEdit={() => setEditing({ kind: "session", record: s })}
            onDelete={() => setDeleting({ kind: "session", id: s.id, label: `Session #${s.id}` })} />
        )
      } },
  ], [startSession])

  const dryerColumns = useMemo<TableColumn<Dryer>[]>(() => [
    { accessorKey: "name", header: "Name", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "dryer_type", header: "Type" },
    { id: "capacity", header: "Capacity", accessorFn: (r) => n(r.capacity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.capacity)}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const d = row.original
        const extra = []
        if (d.status !== "Available") extra.push({ label: "Mark available", icon: <Power className="size-4" />, onSelect: () => markAvailable({ id: d.id }) })
        if (d.status !== "Maintenance") extra.push({ label: "Send to maintenance", icon: <Wrench className="size-4" />, onSelect: () => sendToMaintenance({ id: d.id }) })
        return (
          <RowActions extra={extra} onEdit={() => setEditing({ kind: "dryer", record: d })}
            onDelete={() => setDeleting({ kind: "dryer", id: d.id, label: d.name })} />
        )
      } },
  ], [markAvailable, sendToMaintenance])

  const loadError = [sessions, dryers].find((q) => q.isError)
  const loading = [sessions, dryers].some((q) => q.isPending)

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Drying" icon="drying" description="Dryers and drying sessions. Completed output becomes sellable stock."
        actions={tab === "dryers"
          ? <Button onClick={() => setEditing({ kind: "dryer", record: null })}><Plus className="size-4" /> Add dryer</Button>
          : <Button onClick={() => setEditing({ kind: "session", record: null })}><Plus className="size-4" /> Add session</Button>} />

      {loadError ? (
        <ErrorState message={loadError.error!.message} onRetry={() => { sessions.refetch(); dryers.refetch() }} />
      ) : loading ? (
        <TableSkeleton columns={8} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="dryers">Dryers</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-4">
            <DryingDashboard sessions={sessions.data!} dryers={dryers.data!} />
          </TabsContent>
          <TabsContent value="sessions" className="mt-4">
            <DataTable columns={sessionColumns} data={sessions.data!.filter((s) => sessionStatus === ALL || s.status === sessionStatus)}
              searchPlaceholder="Search dryer, fabric, supervisor…" emptyTitle="No drying sessions"
              initialSorting={[{ id: "id", desc: true }]} exportName="drying-sessions"
              filters={sessionStatus !== ALL ? [{ label: `Status: ${sessionStatus}`, onClear: () => setSessionStatus(ALL) }] : []}
              toolbar={<StatusSelect value={sessionStatus} onChange={setSessionStatus} statuses={SESSION_STATUSES} label="Status" />} />
          </TabsContent>
          <TabsContent value="dryers" className="mt-4">
            <DataTable columns={dryerColumns} data={dryers.data!.filter((d) => dryerStatus === ALL || d.status === dryerStatus)}
              searchPlaceholder="Search dryers…" emptyTitle="No dryers" exportName="dryers"
              filters={dryerStatus !== ALL ? [{ label: `Status: ${dryerStatus}`, onClear: () => setDryerStatus(ALL) }] : []}
              toolbar={<StatusSelect value={dryerStatus} onChange={setDryerStatus} statuses={DRYER_STATUSES} label="Dryer status" />} />
          </TabsContent>
        </Tabs>
      )}

      <DryerDialog open={editing?.kind === "dryer"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "dryer" ? editing.record : null} />
      <SessionDialog open={editing?.kind === "session"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "session" ? editing.record : null}
        dryers={dryers.data ?? []} fabrics={fabrics.data ?? []} decolorSessions={decolorDone.data ?? []} users={users.data ?? []} />
      <CompleteDialog session={completing} onOpenChange={(o) => !o && setCompleting(null)} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting?.kind === "dryer" ? "Delete dryer?" : "Delete drying session?"}
        description={deleting?.kind === "session"
          ? `“${deleting.label}” will be removed. If it was completed, its output is taken back out of sellable stock.`
          : `“${deleting?.label}” will be removed. Dryers with sessions can't be deleted.`}
        onConfirm={async () => {
          if (deleting) await removers[deleting.kind].mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
