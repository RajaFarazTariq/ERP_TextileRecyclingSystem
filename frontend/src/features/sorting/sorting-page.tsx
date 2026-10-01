"use client"

import { CheckCircle2, Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { NameWithAvatar } from "@/components/common/identity"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDelete, useList } from "@/lib/crud"
import { kg } from "@/lib/format"
import type { FabricLot, FactoryUnit, SortingSession, StockEntry, UserSummary } from "@/types/api"
import { FABRIC_STATUSES, SESSION_STATUSES } from "./schemas"
import { SortingDashboard } from "./sorting-dashboard"
import { CompleteDialog, FabricDialog, SessionDialog } from "./sorting-forms"

type Tab = "dashboard" | "sessions" | "fabric"
type Editing = { kind: "session"; record: SortingSession | null } | { kind: "fabric"; record: FabricLot | null }
type Deleting = { kind: "session" | "fabric"; id: number; label: string }

const ALL = "all"
const n = (v: string | number) => Number(v) || 0

function StatusFilter({ value, onChange, statuses }: { value: string; onChange: (v: string) => void; statuses: readonly string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[190px]" aria-label="Status"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All statuses</SelectItem>
        {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function SortingPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [sessionStatus, setSessionStatus] = useState(ALL)
  const [fabricStatus, setFabricStatus] = useState(ALL)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [completing, setCompleting] = useState<SortingSession | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)

  const sessions = useList<SortingSession>("sorting/sessions")
  const fabrics = useList<FabricLot>("sorting/fabric-stock")
  const deliveries = useList<StockEntry>("warehouse/stock")
  const users = useList<UserSummary>("users/list")
  const units = useList<FactoryUnit>("warehouse/units")

  const removers = {
    session: useDelete("sorting/sessions", { noun: "Sorting session", invalidate: [["sorting/fabric-stock"]] }),
    fabric: useDelete("sorting/fabric-stock", { noun: "Fabric lot" }),
  }

  const sessionColumns = useMemo<TableColumn<SortingSession>[]>(() => [
    { accessorKey: "id", header: "#", cell: ({ getValue }) => <span className="text-muted-foreground">#{getValue<number>()}</span> },
    { accessorKey: "fabric_material", header: "Fabric", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "supervisor_name", header: "Supervisor", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { accessorKey: "unit", header: "Unit" },
    { id: "input", header: "Input", accessorFn: (r) => n(r.quantity_taken), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.quantity_taken)}</span> },
    { id: "sorted", header: "Sorted", accessorFn: (r) => n(r.quantity_sorted), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.quantity_sorted)}</span> },
    { id: "waste", header: "Waste", accessorFn: (r) => n(r.waste_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.waste_quantity)}</span> },
    {
      id: "efficiency", header: "Efficiency", sortFn: "basic",
      accessorFn: (r) => (n(r.quantity_taken) > 0 ? (n(r.quantity_sorted) / n(r.quantity_taken)) * 100 : 0),
      cell: ({ row }) => row.original.status === "Completed"
        ? <span className="tabular-nums">{((n(row.original.quantity_sorted) / Math.max(n(row.original.quantity_taken), 1)) * 100).toFixed(1)}%</span>
        : <span className="text-muted-foreground">—</span>,
    },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    {
      id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          extra={row.original.status !== "Completed"
            ? [{ label: "Complete", icon: <CheckCircle2 className="size-4" />, onSelect: () => setCompleting(row.original) }]
            : []}
          onEdit={() => setEditing({ kind: "session", record: row.original })}
          onDelete={() => setDeleting({ kind: "session", id: row.original.id, label: `Session #${row.original.id}` })}
        />
      ),
    },
  ], [])

  const fabricColumns = useMemo<TableColumn<FabricLot>[]>(() => [
    { accessorKey: "material_type", header: "Material", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "stock_vendor", header: "Vendor" },
    { id: "initial", header: "Initial", accessorFn: (r) => n(r.initial_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.initial_quantity)}</span> },
    { id: "sorted", header: "Sorted", accessorFn: (r) => n(r.sorted_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.sorted_quantity)}</span> },
    { id: "remaining", header: "Remaining", accessorFn: (r) => n(r.remaining_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.remaining_quantity)}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    {
      id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          onEdit={() => setEditing({ kind: "fabric", record: row.original })}
          onDelete={() => setDeleting({ kind: "fabric", id: row.original.id, label: row.original.material_type })}
        />
      ),
    },
  ], [])

  const shownSessions = (sessions.data ?? []).filter((s) => sessionStatus === ALL || s.status === sessionStatus)
  const shownFabrics = (fabrics.data ?? []).filter((f) => fabricStatus === ALL || f.status === fabricStatus)

  const action = tab === "fabric"
    ? <Button onClick={() => setEditing({ kind: "fabric", record: null })}><Plus className="size-4" /> Add fabric lot</Button>
    : <Button onClick={() => setEditing({ kind: "session", record: null })}><Plus className="size-4" /> Start session</Button>

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Sorting" icon="sorting" description="Sorting sessions, fabric lots and sorting efficiency." actions={action} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="fabric">Fabric lots</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          {sessions.isError ? <ErrorState message={sessions.error.message} onRetry={() => sessions.refetch()} />
            : sessions.isPending ? <TableSkeleton rows={4} columns={4} />
            : <SortingDashboard sessions={sessions.data} />}
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          {sessions.isError ? <ErrorState message={sessions.error.message} onRetry={() => sessions.refetch()} />
            : sessions.isPending ? <TableSkeleton columns={9} />
            : (
              <DataTable columns={sessionColumns} data={shownSessions} searchPlaceholder="Search fabric, supervisor, unit…"
                emptyTitle="No sorting sessions" emptyDescription="Start one with “Start session”."
                initialSorting={[{ id: "id", desc: true }]} exportName="sorting-sessions"
                filters={sessionStatus !== ALL ? [{ label: `Status: ${sessionStatus}`, onClear: () => setSessionStatus(ALL) }] : []}
                toolbar={<StatusFilter value={sessionStatus} onChange={setSessionStatus} statuses={SESSION_STATUSES} />} />
            )}
        </TabsContent>

        <TabsContent value="fabric" className="mt-4">
          {fabrics.isError ? <ErrorState message={fabrics.error.message} onRetry={() => fabrics.refetch()} />
            : fabrics.isPending ? <TableSkeleton columns={6} />
            : (
              <DataTable columns={fabricColumns} data={shownFabrics} searchPlaceholder="Search material, vendor…"
                emptyTitle="No fabric lots" emptyDescription="Add a lot from a warehouse delivery." exportName="fabric-lots"
                filters={fabricStatus !== ALL ? [{ label: `Status: ${fabricStatus}`, onClear: () => setFabricStatus(ALL) }] : []}
                toolbar={<StatusFilter value={fabricStatus} onChange={setFabricStatus} statuses={FABRIC_STATUSES} />} />
            )}
        </TabsContent>
      </Tabs>

      <SessionDialog open={editing?.kind === "session"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "session" ? editing.record : null}
        fabrics={fabrics.data ?? []} users={users.data ?? []} units={units.data ?? []} />
      <FabricDialog open={editing?.kind === "fabric"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "fabric" ? editing.record : null} deliveries={deliveries.data ?? []} />
      <CompleteDialog session={completing} onOpenChange={(o) => !o && setCompleting(null)} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting?.kind === "session" ? "Delete sorting session?" : "Delete fabric lot?"}
        description={`“${deleting?.label}” will be removed. Records that depend on it can't be deleted.`}
        onConfirm={async () => {
          if (deleting) await removers[deleting.kind].mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
