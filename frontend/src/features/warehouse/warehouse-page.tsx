"use client"

import { Clock3, Plus, Scale, Truck, Users } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, dateParams, periodLabel } from "@/components/common/date-filter"
import { NameWithAvatar, PlateChip } from "@/components/common/identity"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDelete, useList } from "@/lib/crud"
import { date, kg, plural } from "@/lib/format"
import type { FactoryUnit, StockEntry, Vendor } from "@/types/api"
import { STOCK_STATUSES } from "./schemas"
import { StockDialog, UnitDialog, VendorDialog } from "./warehouse-forms"

type Tab = "stock" | "vendors" | "units"
type Editing =
  | { kind: "stock"; record: StockEntry | null }
  | { kind: "vendor"; record: Vendor | null }
  | { kind: "unit"; record: FactoryUnit | null }
type Deleting = { kind: "stock" | "vendor" | "unit"; id: number; label: string }

const ALL = "all"

export function WarehousePage() {
  const [tab, setTab] = useState<Tab>("stock")
  const [period, setPeriod] = useState<DateFilterValue>({ type: "all" })
  const [status, setStatus] = useState<string>(ALL)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)

  const stock = useList<StockEntry>("warehouse/stock", { ...dateParams(period), status: status === ALL ? undefined : status })
  const vendors = useList<Vendor>("warehouse/vendors")
  const units = useList<FactoryUnit>("warehouse/units")

  const removers = {
    stock: useDelete("warehouse/stock", { noun: "Stock entry" }),
    vendor: useDelete("warehouse/vendors", { noun: "Vendor" }),
    unit: useDelete("warehouse/units", { noun: "Factory unit" }),
  }

  const stockColumns = useMemo<TableColumn<StockEntry>[]>(() => [
    { accessorKey: "vendor_name", header: "Vendor", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { accessorKey: "fabric_type", header: "Fabric type" },
    { accessorKey: "vehicle_no", header: "Vehicle no.", cell: ({ getValue }) => <PlateChip value={getValue<string>()} /> },
    {
      id: "our_weight", header: "Weight", accessorFn: (r) => Number(r.our_weight), sortFn: "basic",
      cell: ({ row }) => <span className="font-medium">{kg(row.original.our_weight)}</span>,
    },
    { accessorKey: "unit_name", header: "Unit" },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    {
      id: "created_at", header: "Date", accessorFn: (r) => new Date(r.created_at), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.created_at)}</span>,
    },
    {
      id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          onEdit={() => setEditing({ kind: "stock", record: row.original })}
          onDelete={() => setDeleting({ kind: "stock", id: row.original.id, label: `${row.original.fabric_type} from ${row.original.vendor_name}` })}
        />
      ),
    },
  ], [])

  const vendorColumns = useMemo<TableColumn<Vendor>[]>(() => [
    { accessorKey: "name", header: "Name", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { accessorKey: "contact", header: "Contact", cell: ({ getValue }) => getValue<string>() || "—" },
    { accessorKey: "address", header: "Address", cell: ({ getValue }) => getValue<string>() || "—" },
    {
      id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          onEdit={() => setEditing({ kind: "vendor", record: row.original })}
          onDelete={() => setDeleting({ kind: "vendor", id: row.original.id, label: row.original.name })}
        />
      ),
    },
  ], [])

  const unitColumns = useMemo<TableColumn<FactoryUnit>[]>(() => [
    { accessorKey: "name", header: "Unit name", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    {
      id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          onEdit={() => setEditing({ kind: "unit", record: row.original })}
          onDelete={() => setDeleting({ kind: "unit", id: row.original.id, label: row.original.name })}
        />
      ),
    },
  ], [])

  const stockTotal = (stock.data ?? []).reduce((a, s) => a + (Number(s.our_weight) || 0), 0)

  const addLabel = { stock: "Add stock", vendors: "Add vendor", units: "Add unit" }[tab]
  const openAdd = () =>
    setEditing(tab === "stock" ? { kind: "stock", record: null } : tab === "vendors" ? { kind: "vendor", record: null } : { kind: "unit", record: null })

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Warehouse"
        icon="warehouse"
        description="Incoming fabric deliveries, vendors and factory units."
        actions={<Button onClick={openAdd}><Plus className="size-4" /> {addLabel}</Button>}
      />

      {stock.data && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Deliveries" icon={Truck} tone="warehouse" value={stock.data.length}
            hint={period.type === "all" ? "All time" : periodLabel(period)} />
          <StatCard label="Weight received" icon={Scale} tone="brand" value={kg(stockTotal)} hint="Our weighbridge figure" />
          <StatCard label="Pending approval" icon={Clock3} tone="warning" value={stock.data.filter((s) => s.status === "Pending").length}
            hint="Waiting to be checked" />
          <StatCard label="Vendors" icon={Users} tone="info" value={vendors.data?.length ?? 0}
            hint={plural(new Set(stock.data.map((s) => s.vendor)).size, "vendor") + " delivered"} />
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="stock">Stock entries</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="units">Factory units</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          {stock.isError ? (
            <ErrorState message={stock.error.message} onRetry={() => stock.refetch()} />
          ) : (
            <>
              {stock.isPending ? (
                <TableSkeleton columns={7} />
              ) : (
                <DataTable
                  columns={stockColumns}
                  data={stock.data}
                  searchPlaceholder="Search vendor, fabric, vehicle…"
                  emptyTitle="No stock entries"
                  emptyDescription="Record the first delivery with “Add stock”."
                  initialSorting={[{ id: "created_at", desc: true }]}
                  exportName="stock-entries"
                  filters={[
                    ...(status !== ALL ? [{ label: `Status: ${status}`, onClear: () => setStatus(ALL) }] : []),
                    ...(period.type !== "all" ? [{ label: `Period: ${periodLabel(period)}`, onClear: () => setPeriod({ type: "all" }) }] : []),
                  ]}
                  toolbar={
                    <>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="h-9 w-[140px]" aria-label="Status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>All statuses</SelectItem>
                          {STOCK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <DateFilter value={period} onChange={setPeriod} />
                    </>
                  }
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="vendors" className="mt-4">
          {vendors.isError ? (
            <ErrorState message={vendors.error.message} onRetry={() => vendors.refetch()} />
          ) : vendors.isPending ? (
            <TableSkeleton columns={3} />
          ) : (
            <DataTable columns={vendorColumns} data={vendors.data} searchPlaceholder="Search vendors…" exportName="vendors"
              emptyTitle="No vendors" emptyDescription="Add the suppliers you receive fabric from." />
          )}
        </TabsContent>

        <TabsContent value="units" className="mt-4">
          {units.isError ? (
            <ErrorState message={units.error.message} onRetry={() => units.refetch()} />
          ) : units.isPending ? (
            <TableSkeleton columns={2} />
          ) : (
            <DataTable columns={unitColumns} data={units.data} emptyTitle="No factory units" />
          )}
        </TabsContent>
      </Tabs>

      <StockDialog
        open={editing?.kind === "stock"}
        onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "stock" ? editing.record : null}
        vendors={vendors.data ?? []}
        units={units.data ?? []}
      />
      <VendorDialog open={editing?.kind === "vendor"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "vendor" ? editing.record : null} />
      <UnitDialog open={editing?.kind === "unit"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "unit" ? editing.record : null} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.kind === "stock" ? "stock entry" : deleting?.kind === "vendor" ? "vendor" : "factory unit"}?`}
        description={`“${deleting?.label}” will be removed. Records that depend on it can't be deleted.`}
        onConfirm={async () => {
          if (deleting) await removers[deleting.kind].mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
