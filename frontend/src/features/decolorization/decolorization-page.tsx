"use client"

import { CheckCircle2, Cylinder, ExternalLink, FlaskConical, Lock, Plus, Search, ShieldCheck } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, matchesDate, periodLabel } from "@/components/common/date-filter"
import { NameWithAvatar } from "@/components/common/identity"
import { MachineCard } from "@/components/common/machine-card"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/features/auth/use-session"
import { useAction, useDelete, useList } from "@/lib/crud"
import { date, kg, rupees } from "@/lib/format"
import type {
  Chemical, ChemicalIssuance, ChemicalLot, DecolorizationSession, FabricOption, Recipe, SupplierOption, Tank, UserSummary,
} from "@/types/api"
import { ConsumptionSheet, LotDialog, RecipeDialog, UsagePanel, processText } from "./chemical-extras"
import { ChemicalLevel, DecolorizationDashboard, isLowStock } from "./decolorization-dashboard"
import { ChemicalDialog, CompleteDialog, IssuanceDialog, SessionDialog, TankDialog } from "./decolorization-forms"
import { SESSION_STATUSES, TANK_STATUSES } from "./schemas"

type Tab = "dashboard" | "tanks" | "chemicals" | "lots" | "recipes" | "issuances" | "sessions" | "usage"
type Kind = "tank" | "chemical" | "issuance" | "session" | "lot" | "recipe"
type Editing =
  | { kind: "lot"; record: ChemicalLot | null }
  | { kind: "recipe"; record: Recipe | null }
  | { kind: "tank"; record: Tank | null }
  | { kind: "chemical"; record: Chemical | null }
  | { kind: "issuance"; record: ChemicalIssuance | null }
  | { kind: "session"; record: DecolorizationSession | null }
type Deleting = { kind: Kind; id: number; label: string }

const ALL = "all"
const n = (v: string | number | null | undefined) => Number(v) || 0
const NOUN: Record<Kind, string> = {
  tank: "tank", chemical: "chemical", issuance: "chemical issuance", session: "session", lot: "chemical lot", recipe: "recipe",
}
const isLink = (v: string) => /^https?:\/\//i.test(v)

function TankCard({ tank, onEdit, onDelete }: { tank: Tank; onEdit: () => void; onDelete: () => void }) {
  return (
    <MachineCard
      name={tank.name}
      subtitle={`Batch ${tank.batch_id}`}
      status={tank.tank_status}
      icon={Cylinder}
      tone="decolorization"
      load={n(tank.fabric_quantity)}
      capacity={n(tank.capacity)}
      loadLabel={`${tank.name} fill level`}
      runningSince={tank.tank_status === "Processing" ? tank.start_date : null}
      detail={tank.fabric_material ? `Fabric: ${tank.fabric_material}` : "No fabric assigned"}
      actions={<RowActions onEdit={onEdit} onDelete={onDelete} />}
    />
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
  const [viewing, setViewing] = useState<DecolorizationSession | null>(null)
  const isAdmin = useSession().data?.role === "admin"

  const tanks = useList<Tank>("decolorization/tanks")
  const chemicals = useList<Chemical>("decolorization/chemicals")
  const issuances = useList<ChemicalIssuance>("decolorization/issuances")
  const sessions = useList<DecolorizationSession>("decolorization/sessions")
  const fabrics = useList<FabricOption>("decolorization/fabric-stock")
  const users = useList<UserSummary>("users/list")
  const lots = useList<ChemicalLot>("decolorization/lots")
  const recipes = useList<Recipe>("decolorization/recipes")
  const suppliers = useList<SupplierOption>("decolorization/suppliers")
  const { mutate: approve } = useAction("decolorization/sessions", "approve", { success: "Batch approved." })

  const removers = {
    tank: useDelete("decolorization/tanks", { noun: "Tank" }),
    chemical: useDelete("decolorization/chemicals", { noun: "Chemical" }),
    issuance: useDelete("decolorization/issuances", {
      noun: "Chemical issuance", invalidate: [["decolorization/chemicals"], ["decolorization/sessions"], ["decolorization/usage"]],
    }),
    session: useDelete("decolorization/sessions", { noun: "Decolorization session" }),
    lot: useDelete("decolorization/lots", { noun: "Chemical lot", invalidate: [["decolorization/chemicals"]] }),
    recipe: useDelete("decolorization/recipes", { noun: "Recipe" }),
  }

  const chemicalColumns = useMemo<TableColumn<Chemical>[]>(() => [
    { accessorKey: "chemical_name", header: "Chemical",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{row.original.chemical_name}</span>
          {row.original.is_restricted && <Badge variant="outline" title="Only an admin can issue it"><Lock aria-hidden /> Restricted</Badge>}
        </span>
      ) },
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
    { id: "cost", header: "Cost per unit", accessorFn: (r) => n(r.unit_cost), sortFn: "basic",
      cell: ({ row }) => n(row.original.unit_cost)
        ? <span className="tabular-nums">{rupees(row.original.unit_cost)}</span> : <span className="text-muted-foreground">—</span> },
    { id: "safety", header: "Safety", accessorFn: (r) => r.hazard_class,
      cell: ({ row }) => {
        const { hazard_class, sds_reference, handling_notes } = row.original
        if (!hazard_class && !sds_reference) return <span className="text-muted-foreground">—</span>
        return (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1" title={handling_notes || undefined}>
            {hazard_class && <Badge variant="destructive">{hazard_class}</Badge>}
            {isLink(sds_reference)
              ? <a href={sds_reference} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline underline-offset-2">Data sheet <ExternalLink className="size-3" aria-hidden /></a>
              : sds_reference && <span className="text-xs text-muted-foreground">{sds_reference}</span>}
          </span>
        )
      } },
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
      cell: ({ row }) => <span className="tabular-nums">{n(row.original.quantity).toLocaleString()} {row.original.unit_of_measure}</span> },
    { id: "batch", header: "Batch", accessorFn: (r) => r.session ?? 0, sortFn: "basic",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.session ? `#${row.original.session}` : "—"}</span> },
    { id: "cost", header: "Cost", accessorFn: (r) => n(r.cost), sortFn: "basic",
      cell: ({ row }) => n(row.original.cost)
        ? <span className="tabular-nums">{rupees(row.original.cost)}</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "issued_by_name", header: "Issued by", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
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
    { accessorKey: "supervisor_name", header: "Supervisor", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { id: "input", header: "Input", accessorFn: (r) => n(r.input_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.input_quantity)}</span> },
    { id: "output", header: "Output", accessorFn: (r) => n(r.output_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.output_quantity)}</span> },
    { id: "waste", header: "Waste", accessorFn: (r) => n(r.waste_quantity), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.waste_quantity)}</span> },
    { id: "efficiency", header: "Efficiency", sortFn: "basic",
      accessorFn: (r) => (n(r.input_quantity) > 0 ? (n(r.output_quantity) / n(r.input_quantity)) * 100 : 0),
      cell: ({ row }) => row.original.status === "Completed"
        ? <span className="tabular-nums">{((n(row.original.output_quantity) / Math.max(n(row.original.input_quantity), 1)) * 100).toFixed(1)}%</span>
        : <span className="text-muted-foreground">—</span> },
    { id: "recipe", header: "Recipe", accessorFn: (r) => r.recipe_name ?? "",
      cell: ({ row }) => row.original.recipe_name ?? <span className="text-muted-foreground">—</span> },
    { id: "chemical_cost", header: "Chemical cost", accessorFn: (r) => n(r.chemical_cost), sortFn: "basic",
      cell: ({ row }) => n(row.original.chemical_cost)
        ? <span className="tabular-nums">{rupees(row.original.chemical_cost)}</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "approved", header: "Approved", accessorFn: (r) => r.approved_by_name ?? "",
      cell: ({ row }) => row.original.approved_at
        ? <span title={date(row.original.approved_at)}>{row.original.approved_by_name}</span> : <span className="text-muted-foreground">—</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          extra={[
            ...(row.original.status !== "Completed"
              ? [{ label: "Complete", icon: <CheckCircle2 className="size-4" />, onSelect: () => setCompleting(row.original) }] : []),
            { label: "Chemicals used", icon: <FlaskConical className="size-4" />, onSelect: () => setViewing(row.original) },
            ...(isAdmin && !row.original.approved_at
              ? [{ label: "Approve batch", icon: <ShieldCheck className="size-4" />, onSelect: () => approve({ id: row.original.id }) }] : []),
          ]}
          onEdit={() => setEditing({ kind: "session", record: row.original })}
          onDelete={() => setDeleting({ kind: "session", id: row.original.id, label: `Session #${row.original.id}` })} />
      ) },
  ], [isAdmin, approve])

  const lotColumns = useMemo<TableColumn<ChemicalLot>[]>(() => [
    { accessorKey: "lot_number", header: "Lot", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "chemical_name", header: "Chemical" },
    { id: "quantity", header: "Quantity", accessorFn: (r) => n(r.quantity), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{n(row.original.quantity).toLocaleString()} {row.original.unit_of_measure}</span> },
    { id: "cost", header: "Cost per unit", accessorFn: (r) => n(r.unit_cost), sortFn: "basic",
      cell: ({ row }) => n(row.original.unit_cost)
        ? <span className="tabular-nums">{rupees(row.original.unit_cost)}</span> : <span className="text-muted-foreground">—</span> },
    { id: "supplier", header: "Supplier", accessorFn: (r) => r.supplier_name ?? "",
      cell: ({ row }) => row.original.supplier_name ?? <span className="text-muted-foreground">—</span> },
    { id: "received_on", header: "Received", accessorFn: (r) => new Date(r.received_on), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.received_on)}</span> },
    { id: "expiry", header: "Expiry", accessorFn: (r) => r.expiry_date ?? "",
      cell: ({ row }) => !row.original.expiry_date ? <span className="text-muted-foreground">—</span>
        : row.original.expired ? <Badge variant="destructive">Expired {date(row.original.expiry_date)}</Badge>
        : <span className="text-muted-foreground">{date(row.original.expiry_date)}</span> },
    { accessorKey: "received_by_name", header: "Received by", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <RowActions onEdit={() => setEditing({ kind: "lot", record: row.original })}
          onDelete={() => setDeleting({ kind: "lot", id: row.original.id, label: `Lot ${row.original.lot_number}` })} />
      ) },
  ], [])

  const recipeColumns = useMemo<TableColumn<Recipe>[]>(() => [
    { accessorKey: "name", header: "Recipe", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "material", header: "Material", accessorFn: (r) => r.material_type,
      cell: ({ row }) => row.original.material_type || <span className="text-muted-foreground">Any</span> },
    { id: "version", header: "Version", accessorFn: (r) => r.versions[0]?.version ?? 0, sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">v{row.original.versions[0]?.version}</span> },
    { id: "chemicals", header: "Chemicals per 100 kg", enableSorting: false,
      accessorFn: (r) => r.versions[0]?.lines.map((l) => l.chemical_name).join(" ") ?? "",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.versions[0]?.lines.map((l) => `${l.chemical_name} ${n(l.quantity_per_100kg).toLocaleString()} ${l.unit_of_measure}`).join(", ")}
        </span>
      ) },
    { id: "process", header: "Process", enableSorting: false, accessorFn: (r) => (r.versions[0] ? processText(r.versions[0]) : ""),
      cell: ({ getValue }) => getValue<string>() || <span className="text-muted-foreground">—</span> },
    { id: "batches", header: "Batches", accessorFn: (r) => r.versions.reduce((sum, v) => sum + v.sessions, 0), sortFn: "basic",
      cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
    { id: "status", header: "Status", accessorFn: (r) => (r.is_active ? "In use" : "Not in use"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "In use" : "Not in use"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <RowActions onEdit={() => setEditing({ kind: "recipe", record: row.original })}
          onDelete={() => setDeleting({ kind: "recipe", id: row.original.id, label: row.original.name })} />
      ) },
  ], [])

  const addFor: Record<Tab, { label: string; open: () => void }> = {
    dashboard: { label: "Start session", open: () => setEditing({ kind: "session", record: null }) },
    tanks: { label: "Add tank", open: () => setEditing({ kind: "tank", record: null }) },
    chemicals: { label: "Add chemical", open: () => setEditing({ kind: "chemical", record: null }) },
    lots: { label: "Receive lot", open: () => setEditing({ kind: "lot", record: null }) },
    recipes: { label: "New recipe", open: () => setEditing({ kind: "recipe", record: null }) },
    issuances: { label: "Issue chemical", open: () => setEditing({ kind: "issuance", record: null }) },
    usage: { label: "Issue chemical", open: () => setEditing({ kind: "issuance", record: null }) },
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
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Decolorization" icon="decolorization" description="Tanks, chemical stock, recipes and issuances, and decolorization sessions."
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
            <TabsTrigger value="lots">Lots</TabsTrigger>
            <TabsTrigger value="recipes">Recipes</TabsTrigger>
            <TabsTrigger value="issuances">Issuances</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <DecolorizationDashboard tanks={tanks.data!} chemicals={chemicals.data!} issuances={issuances.data!} sessions={sessions.data!} />
          </TabsContent>

          <TabsContent value="tanks" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={tankSearch} onChange={(e) => setTankSearch(e.target.value)} placeholder="Search tank, batch, fabric…"
                  aria-label="Search tanks" className="h-9 pl-9" />
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
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {shownTanks.map((t) => (
                  <TankCard key={t.id} tank={t} onEdit={() => setEditing({ kind: "tank", record: t })}
                    onDelete={() => setDeleting({ kind: "tank", id: t.id, label: t.name })} />
                ))}
              </div>
            ) : tanks.data!.length ? <EmptyState title="No matching tanks" description="Try a different search or status." />
              : <EmptyState title="No tanks" description="Add the tanks used for decolorization." />}
          </TabsContent>

          <TabsContent value="chemicals" className="mt-4">
            <DataTable columns={chemicalColumns} data={chemicals.data!} searchPlaceholder="Search chemicals…" emptyTitle="No chemicals" exportName="chemicals" />
          </TabsContent>

          <TabsContent value="lots" className="mt-4">
            <DataTable columns={lotColumns} data={lots.data ?? []} searchPlaceholder="Search lot, chemical, supplier…"
              emptyTitle="No lots received" initialSorting={[{ id: "received_on", desc: true }]} exportName="chemical-lots" />
          </TabsContent>

          <TabsContent value="recipes" className="mt-4">
            <DataTable columns={recipeColumns} data={recipes.data ?? []} searchPlaceholder="Search recipe, material, chemical…"
              emptyTitle="No recipes" exportName="recipes" />
          </TabsContent>

          <TabsContent value="usage" className="mt-4">
            <UsagePanel />
          </TabsContent>

          <TabsContent value="issuances" className="mt-4">
            <DataTable columns={issuanceColumns} data={issuances.data!} searchPlaceholder="Search chemical, tank, person…"
              emptyTitle="No issuances" initialSorting={[{ id: "issued_at", desc: true }]} exportName="chemical-issuances" />
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            <DataTable columns={sessionColumns} data={shownSessions} searchPlaceholder="Search tank, fabric, supervisor…"
              emptyTitle="No decolorization sessions" initialSorting={[{ id: "id", desc: true }]} exportName="decolorization-sessions"
              filters={[
                ...(sessionStatus !== ALL ? [{ label: `Status: ${sessionStatus}`, onClear: () => setSessionStatus(ALL) }] : []),
                ...(sessionPeriod.type !== "all" ? [{ label: `Period: ${periodLabel(sessionPeriod)}`, onClear: () => setSessionPeriod({ type: "all" }) }] : []),
              ]}
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
        record={editing?.kind === "chemical" ? editing.record : null} suppliers={suppliers.data ?? []} />
      <LotDialog open={editing?.kind === "lot"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "lot" ? editing.record : null} chemicals={chemicals.data ?? []} suppliers={suppliers.data ?? []} />
      <RecipeDialog open={editing?.kind === "recipe"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "recipe" ? editing.record : null} chemicals={chemicals.data ?? []} />
      <ConsumptionSheet session={viewing} onOpenChange={(o) => !o && setViewing(null)} />
      <IssuanceDialog open={editing?.kind === "issuance"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "issuance" ? editing.record : null}
        chemicals={chemicals.data ?? []} tanks={tanks.data ?? []} users={users.data ?? []} />
      <SessionDialog open={editing?.kind === "session"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "session" ? editing.record : null}
        tanks={tanks.data ?? []} fabrics={fabrics.data ?? []} users={users.data ?? []} recipes={recipes.data ?? []} />
      <CompleteDialog session={completing} onOpenChange={(o) => !o && setCompleting(null)} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting ? NOUN[deleting.kind] : ""}?`}
        description={deleting?.kind === "issuance"
          ? `“${deleting.label}” will be removed and its quantity returned to chemical stock.`
          : deleting?.kind === "lot"
          ? `“${deleting.label}” will be removed and its quantity taken back out of chemical stock.`
          : `“${deleting?.label}” will be removed. Records that depend on it can't be deleted.`}
        onConfirm={async () => {
          if (deleting) await removers[deleting.kind].mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
