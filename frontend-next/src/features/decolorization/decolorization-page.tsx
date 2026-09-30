"use client"

import { CheckCircle2, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, matchesDate } from "@/components/common/date-filter"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDelete, useList } from "@/lib/crud"
import { date, kg } from "@/lib/format"
import type { Chemical, ChemicalIssuance, DecolorizationSession, FabricOption, Tank, UserSummary } from "@/types/api"
import { ChemicalLevel, DecolorizationDashboard, isLowStock } from "./decolorization-dashboard"
import { ChemicalDialog, CompleteDialog, IssuanceDialog, SessionDialog, TankDialog } from "./decolorization-forms"
import { SESSION_STATUSES, TANK_STATUSES } from "./schemas"

type Tab = "dashboard" | "tanks" | "chemicals" | "issuances" | "sessions"
type Kind = "tank" | "chemical" | "issuance" | "session"
type Editing =
  | { kind: "tank"; record: Tank | null }
  | { kind: "chemical"; record: Chemical | null }
  | { kind: "issuance"; record: ChemicalIssuance | null }
  | { kind: "session"; record: DecolorizationSession | null }
type Deleting = { kind: Kind; id: number; label: string }

const ALL = "all"
const n = (v: string | number | null | undefined) => Number(v) || 0
const NOUN: Record<Kind, string> = { tank: "tank", chemical: "chemical", issuance: "chemical issuance", session: "session" }

function TankCard({ tank, onEdit, onDelete }: { tank: Tank; onEdit: () => void; onDelete: () => void }) {
  const ratio = n(tank.capacity) > 0 ? n(tank.fabric_quantity) / n(tank.capacity) : 0
  const fill = Math.min(ratio, 1) * 100
  const over = ratio > 1
  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{tank.name}</p>
            <p className="text-xs text-muted-foreground">Batch {tank.batch_id}</p>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge status={tank.tank_status} />
            <RowActions onEdit={onEdit} onDelete={onDelete} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{kg(tank.fabric_quantity)} of {kg(tank.capacity)}</span>
            <span className={over ? "font-semibold text-destructive" : "tabular-nums"}>
              {over ? `Over capacity (${Math.round(ratio * 100)}%)` : `${Math.round(fill)}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${tank.name} fill level`}
            aria-valuenow={Math.round(fill)} aria-valuemin={0} aria-valuemax={100}>
            <div className={over ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-primary"} style={{ width: `${fill}%` }} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{tank.fabric_material ? `Fabric: ${tank.fabric_material}` : "No fabric assigned"}</p>
      </CardContent>
    </Card>
  )
}

export function DecolorizationPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [sessionStatus, setSessionStatus] = useState(ALL)
  const [tankStatus, setTankStatus] = useState(ALL)
  const [tankSearch, setTankSearch] = useState("")
  const [sessionPeriod, setSessionPeriod] = useState<DateFilterValue>({ type: "all" })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [completing, setCompleting] = useState<DecolorizationSession | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)

  const tanks = useList<Tank>("decolorization/tanks")
  const chemicals = useList<Chemical>("decolorization/chemicals")
  const issuances = useList<ChemicalIssuance>("decolorization/issuances")
  const sessions = useList<DecolorizationSession>("decolorization/sessions")
  const fabrics = useList<FabricOption>("decolorization/fabric-stock")
  const users = useList<UserSummary>("users/list")

  const removers = {
    tank: useDelete("decolorization/tanks", { noun: "Tank" }),
    chemical: useDelete("decolorization/chemicals", { noun: "Chemical" }),
    issuance: useDelete("decolorization/issuances", { noun: "Chemical issuance", invalidate: [["decolorization/chemicals"]] }),
    session: useDelete("decolorization/sessions", { noun: "Decolorization session" }),
  }

  const chemicalColumns = useMemo<TableColumn<Chemical>[]>(() => [
    { accessorKey: "chemical_name", header: "Chemical", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "total", header: "Total", accessorFn: (r) => n(r.total_stock), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{n(row.original.total_stock).toLocaleString()} {row.original.unit_of_measure}</span> },
    { id: "remaining", header: "Remaining", accessorFn: (r) => n(r.remaining_stock), sortFn: "basic",
      cell: ({ row }) => (
        <span className={isLowStock(row.original) ? "font-semibold text-destructive tabular-nums" : "tabular-nums"}>
          {n(row.original.remaining_stock).toLocaleString()} {row.original.unit_of_measure}
        </span>
      ) },
    { id: "level", header: "Stock left", accessorFn: (r) => (n(r.total_stock) ? n(r.remaining_stock) / n(r.total_stock) : 0), sortFn: "basic",
      cell: ({ row }) => <ChemicalLevel chemical={row.original} compact /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <RowActions onEdit={() => setEditing({ kind: "chemical", record: row.original })}
          onDelete={() => setDeleting({ kind: "chemical", id: row.original.id, label: row.original.chemical_name })} />
      ) },
  ], [])

  const issuanceColumns = useMemo<TableColumn<ChemicalIssuance>[]>(() => [
    { accessorKey: "chemical_name", header: "Chemical", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "tank_name", header: "Tank" },
    { id: "quantity", header: "Quantity", accessorFn: (r) => n(r.quantity), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{n(row.original.quantity).toLocaleString()}</span> },
    { accessorKey: "issued_by_name", header: "Issued by" },
    { id: "issued_at", header: "Date", accessorFn: (r) => new Date(r.issued_at), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.issued_at)}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <RowActions onEdit={() => setEditing({ kind: "issuance", record: row.original })}
          onDelete={() => setDeleting({ kind: "issuance", id: row.original.id, label: `${row.original.chemical_name} → ${row.original.tank_name}` })} />
      ) },
  ], [])

  const sessionColumns = useMemo<TableColumn<DecolorizationSession>[]>(() => [
    { accessorKey: "id", header: "#", cell: ({ getValue }) => <span className="text-muted-foreground">#{getValue<number>()}</span> },
    { accessorKey: "tank_name", header: "Tank", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "fabric_material", header: "Fabric" },
    { accessorKey: "supervisor_name", header: "Supervisor" },
    { id: "input", header: "Input", accessorFn: (r) => n(r.input_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.input_quantity)}</span> },
    { id: "output", header: "Output", accessorFn: (r) => n(r.output_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.output_quantity)}</span> },
    { id: "waste", header: "Waste", accessorFn: (r) => n(r.waste_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.waste_quantity)}</span> },
    { id: "efficiency", header: "Efficiency", sortFn: "basic",
      accessorFn: (r) => (n(r.input_quantity) > 0 ? (n(r.output_quantity) / n(r.input_quantity)) * 100 : 0),
      cell: ({ row }) => row.original.status === "Completed"
        ? <span className="tabular-nums">{((n(row.original.output_quantity) / Math.max(n(row.original.input_quantity), 1)) * 100).toFixed(1)}%</span>
        : <span className="text-muted-foreground">—</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          extra={row.original.status !== "Completed"
            ? [{ label: "Complete", icon: <CheckCircle2 className="size-4" />, onSelect: () => setCompleting(row.original) }] : []}
          onEdit={() => setEditing({ kind: "session", record: row.original })}
          onDelete={() => setDeleting({ kind: "session", id: row.original.id, label: `Session #${row.original.id}` })} />
      ) },
  ], [])

  const addFor: Record<Tab, { label: string; open: () => void }> = {
    dashboard: { label: "Start session", open: () => setEditing({ kind: "session", record: null }) },
    tanks: { label: "Add tank", open: () => setEditing({ kind: "tank", record: null }) },
    chemicals: { label: "Add chemical", open: () => setEditing({ kind: "chemical", record: null }) },
    issuances: { label: "Issue chemical", open: () => setEditing({ kind: "issuance", record: null }) },
    sessions: { label: "Start session", open: () => setEditing({ kind: "session", record: null }) },
  }

  const loadError = [tanks, chemicals, issuances, sessions].find((q) => q.isError)
  const loading = [tanks, chemicals, issuances, sessions].some((q) => q.isPending)
  const q = tankSearch.trim().toLowerCase()
  const shownTanks = (tanks.data ?? []).filter(
    (t) => (tankStatus === ALL || t.tank_status === tankStatus)
      && (!q || [t.name, t.batch_id, t.fabric_material ?? ""].some((v) => v.toLowerCase().includes(q))),
  )
  const shownSessions = (sessions.data ?? []).filter(
    (s) => (sessionStatus === ALL || s.status === sessionStatus) && matchesDate(s.start_date, sessionPeriod),
  )

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Decolorization" description="Tanks, chemical stock and issuances, and decolorization sessions."
        actions={<Button onClick={addFor[tab].open}><Plus className="size-4" /> {addFor[tab].label}</Button>} />

      {loadError ? (
        <ErrorState message={loadError.error!.message} onRetry={() => [tanks, chemicals, issuances, sessions].forEach((q) => q.refetch())} />
      ) : loading ? (
        <TableSkeleton columns={6} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="tanks">Tanks</TabsTrigger>
            <TabsTrigger value="chemicals">Chemicals</TabsTrigger>
            <TabsTrigger value="issuances">Issuances</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <DecolorizationDashboard tanks={tanks.data!} chemicals={chemicals.data!} issuances={issuances.data!} sessions={sessions.data!} />
          </TabsContent>

          <TabsContent value="tanks" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={tankSearch} onChange={(e) => setTankSearch(e.target.value)} placeholder="Search tank, batch, fabric…"
                  aria-label="Search tanks" className="h-9 pl-8" />
              </div>
              <Select value={tankStatus} onValueChange={setTankStatus}>
                <SelectTrigger className="h-9 w-[150px]" aria-label="Tank status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {TANK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{shownTanks.length} of {tanks.data!.length} tanks</span>
            </div>
            {shownTanks.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shownTanks.map((t) => (
                  <TankCard key={t.id} tank={t} onEdit={() => setEditing({ kind: "tank", record: t })}
                    onDelete={() => setDeleting({ kind: "tank", id: t.id, label: t.name })} />
                ))}
              </div>
            ) : tanks.data!.length ? <EmptyState title="No matching tanks" description="Try a different search or status." />
              : <EmptyState title="No tanks" description="Add the tanks used for decolorization." />}
          </TabsContent>

          <TabsContent value="chemicals" className="mt-4">
            <DataTable columns={chemicalColumns} data={chemicals.data!} searchPlaceholder="Search chemicals…" emptyTitle="No chemicals" />
          </TabsContent>

          <TabsContent value="issuances" className="mt-4">
            <DataTable columns={issuanceColumns} data={issuances.data!} searchPlaceholder="Search chemical, tank, person…"
              emptyTitle="No issuances" initialSorting={[{ id: "issued_at", desc: true }]} />
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            <DataTable columns={sessionColumns} data={shownSessions} searchPlaceholder="Search tank, fabric, supervisor…"
              emptyTitle="No decolorization sessions" initialSorting={[{ id: "id", desc: true }]}
              toolbar={
                <>
                  <Select value={sessionStatus} onValueChange={setSessionStatus}>
                    <SelectTrigger className="h-9 w-[150px]" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All statuses</SelectItem>
                      {SESSION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <DateFilter value={sessionPeriod} onChange={setSessionPeriod} />
                </>
              } />
          </TabsContent>
        </Tabs>
      )}

      <TankDialog open={editing?.kind === "tank"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "tank" ? editing.record : null} fabrics={fabrics.data ?? []} />
      <ChemicalDialog open={editing?.kind === "chemical"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "chemical" ? editing.record : null} />
      <IssuanceDialog open={editing?.kind === "issuance"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "issuance" ? editing.record : null}
        chemicals={chemicals.data ?? []} tanks={tanks.data ?? []} users={users.data ?? []} />
      <SessionDialog open={editing?.kind === "session"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "session" ? editing.record : null}
        tanks={tanks.data ?? []} fabrics={fabrics.data ?? []} users={users.data ?? []} />
      <CompleteDialog session={completing} onOpenChange={(o) => !o && setCompleting(null)} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting ? NOUN[deleting.kind] : ""}?`}
        description={deleting?.kind === "issuance"
          ? `“${deleting.label}” will be removed and its quantity returned to chemical stock.`
          : `“${deleting?.label}” will be removed. Records that depend on it can't be deleted.`}
        onConfirm={async () => {
          if (deleting) await removers[deleting.kind].mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
