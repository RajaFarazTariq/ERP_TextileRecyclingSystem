"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Ban, CheckCircle2, GitMerge, PackageCheck, Plus, Truck } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, dateParams } from "@/components/common/date-filter"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { useAction, useDelete, useList } from "@/lib/crud"
import { date, kg, rupees } from "@/lib/format"
import type { Customer, CustomerDuplicate, Dispatch, FabricLot, Payment, SalesOrder, SalesSummary, UserSummary } from "@/types/api"
import { CustomerDialog, DispatchDialog, MergeDialog, OrderDialog, PaymentDialog } from "./sales-forms"
import { SalesDashboard } from "./sales-dashboard"
import { DISPATCH_STATUSES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from "./schemas"

type Tab = "dashboard" | "orders" | "dispatch" | "payments" | "customers"
type Kind = "order" | "dispatch" | "payment" | "customer"
type Editing =
  | { kind: "order"; record: SalesOrder | null }
  | { kind: "dispatch"; record: Dispatch | null; orderId?: number }
  | { kind: "payment"; record: Payment | null }
  | { kind: "customer"; record: Customer | null }
type Deleting = { kind: Kind; id: number; label: string }

const ALL = "all"
const n = (v: string | number | null | undefined) => Number(v) || 0
const LISTS = [["sales/orders"], ["sales/dispatch"], ["sales/payments"], ["sales/orders/summary"], ["sales/customers"],
  ["sorting/fabric-stock"], ["inventory/movements/stock"]]

function Filter({ value, onChange, options, label, allLabel = "All" }: {
  value: string; onChange: (v: string) => void; options: readonly string[]; label: string; allLabel?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[160px]" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function SalesPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>("dashboard")
  const [period, setPeriod] = useState<DateFilterValue>({ type: "all" })
  const [orderStatus, setOrderStatus] = useState(ALL)
  const [paymentStatus, setPaymentStatus] = useState(ALL)
  const [dispatchStatus, setDispatchStatus] = useState(ALL)
  const [paymentMethod, setPaymentMethod] = useState(ALL)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const [merging, setMerging] = useState<Customer | null>(null)

  const periodParams = dateParams(period)
  const orders = useList<SalesOrder>("sales/orders", periodParams)
  const allOrders = useList<SalesOrder>("sales/orders")
  const dispatches = useList<Dispatch>("sales/dispatch", periodParams)
  const payments = useList<Payment>("sales/payments", periodParams)
  const customers = useList<Customer>("sales/customers")
  const fabrics = useList<FabricLot>("sorting/fabric-stock")
  const users = useList<UserSummary>("users/list")
  const summary = useQuery<SalesSummary>({ queryKey: ["sales/orders/summary"], queryFn: () => api("sales/orders/summary") })
  const duplicates = useQuery<CustomerDuplicate[]>({
    queryKey: ["sales/customers", "duplicates"], queryFn: () => api("sales/customers/duplicates"), enabled: tab === "customers",
  })

  const { mutate: confirmOrder } = useAction("sales/orders", "confirm", { success: "Order confirmed; stock reserved.", invalidate: LISTS })
  const { mutate: cancelOrder } = useAction("sales/orders", "cancel", { success: "Order cancelled; reservation released.", invalidate: LISTS })
  const { mutate: markDelivered } = useAction("sales/dispatch", "mark_delivered", { success: "Marked as delivered; order completed.", invalidate: LISTS })

  const removers = {
    order: useDelete("sales/orders", { noun: "Order", invalidate: LISTS }),
    dispatch: useDelete("sales/dispatch", { noun: "Dispatch", invalidate: LISTS }),
    payment: useDelete("sales/payments", { noun: "Payment", invalidate: LISTS }),
    customer: useDelete("sales/customers", { noun: "Customer" }),
  }

  const buyerOf = useMemo(() => new Map((allOrders.data ?? []).map((o) => [o.id, o.buyer_name])), [allOrders.data])

  const orderColumns = useMemo<TableColumn<SalesOrder>[]>(() => [
    { accessorKey: "id", header: "#", cell: ({ getValue }) => <span className="text-muted-foreground">#{getValue<number>()}</span> },
    { accessorKey: "buyer_name", header: "Buyer", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "fabric_material", header: "Fabric" },
    { accessorKey: "fabric_quality", header: "Quality" },
    { id: "weight", header: "Weight", accessorFn: (r) => n(r.weight_sold), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.weight_sold)}</span> },
    { id: "price", header: "Price/kg", accessorFn: (r) => n(r.price_per_kg), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.price_per_kg)}</span> },
    { id: "total", header: "Total", accessorFn: (r) => n(r.total_price), sortFn: "basic", cell: ({ row }) => <span className="font-medium tabular-nums">{rupees(row.original.total_price)}</span> },
    { accessorKey: "payment_status", header: "Payment", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "created_at", header: "Date", accessorFn: (r) => new Date(r.created_at), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.created_at)}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const o = row.original
        const extra = []
        if (o.status === "Draft") extra.push({ label: "Confirm", icon: <CheckCircle2 className="size-4" />, onSelect: () => confirmOrder({ id: o.id }) })
        if (o.status === "Confirmed" || o.status === "Dispatched") extra.push({ label: "Dispatch", icon: <Truck className="size-4" />, onSelect: () => setEditing({ kind: "dispatch", record: null, orderId: o.id }) })
        if (o.status === "Confirmed") extra.push({ label: "Cancel order", icon: <Ban className="size-4" />, onSelect: () => cancelOrder({ id: o.id }) })
        return <RowActions extra={extra} onEdit={() => setEditing({ kind: "order", record: o })}
          onDelete={() => setDeleting({ kind: "order", id: o.id, label: `Order #${o.id} (${o.buyer_name})` })} />
      } },
  ], [confirmOrder, cancelOrder])

  const dispatchColumns = useMemo<TableColumn<Dispatch>[]>(() => [
    { accessorKey: "id", header: "#", cell: ({ getValue }) => <span className="text-muted-foreground">#{getValue<number>()}</span> },
    { id: "order", header: "Order", accessorFn: (r) => r.order_buyer, cell: ({ row }) => <span className="font-medium">#{row.original.sales_order} {row.original.order_buyer}</span> },
    { accessorKey: "vehicle_number", header: "Vehicle" },
    { accessorKey: "driver_name", header: "Driver", cell: ({ getValue }) => getValue<string>() || "—" },
    { id: "weight", header: "Weight", accessorFn: (r) => n(r.dispatched_weight), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.dispatched_weight)}</span> },
    { accessorKey: "dispatch_status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "dispatch_date", header: "Date", accessorFn: (r) => new Date(r.dispatch_date), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.dispatch_date)}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const d = row.original
        return <RowActions
          extra={d.dispatch_status !== "Delivered" ? [{ label: "Mark delivered", icon: <PackageCheck className="size-4" />, onSelect: () => markDelivered({ id: d.id }) }] : []}
          onEdit={() => setEditing({ kind: "dispatch", record: d })}
          onDelete={() => setDeleting({ kind: "dispatch", id: d.id, label: `Dispatch #${d.id} (${d.vehicle_number})` })} />
      } },
  ], [markDelivered])

  const paymentColumns = useMemo<TableColumn<Payment>[]>(() => [
    { accessorKey: "id", header: "#", cell: ({ getValue }) => <span className="text-muted-foreground">#{getValue<number>()}</span> },
    { id: "order", header: "Order", accessorFn: (r) => buyerOf.get(r.sales_order) ?? "", cell: ({ row }) => <span className="font-medium">#{row.original.sales_order} {buyerOf.get(row.original.sales_order) ?? ""}</span> },
    { id: "amount", header: "Amount", accessorFn: (r) => n(r.amount), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.amount)}</span> },
    { accessorKey: "payment_method", header: "Method" },
    { accessorKey: "reference_number", header: "Reference", cell: ({ getValue }) => getValue<string>() || "—" },
    { accessorKey: "received_by_name", header: "Received by" },
    { id: "payment_date", header: "Date", accessorFn: (r) => new Date(r.payment_date), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.payment_date)}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions onEdit={() => setEditing({ kind: "payment", record: row.original })}
        onDelete={() => setDeleting({ kind: "payment", id: row.original.id, label: `${rupees(row.original.amount)} for order #${row.original.sales_order}` })} /> },
  ], [buyerOf])

  const customerColumns = useMemo<TableColumn<Customer>[]>(() => [
    { accessorKey: "name", header: "Name", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "contact", header: "Contact", cell: ({ getValue }) => getValue<string>() || "—" },
    { accessorKey: "order_count", header: "Orders", sortFn: "basic" },
    { id: "created_at", header: "Since", accessorFn: (r) => new Date(r.created_at), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.created_at)}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions
        extra={[{ label: "Merge into…", icon: <GitMerge className="size-4" />, onSelect: () => setMerging(row.original) }]}
        onEdit={() => setEditing({ kind: "customer", record: row.original })}
        onDelete={() => setDeleting({ kind: "customer", id: row.original.id, label: row.original.name })} /> },
  ], [])

  const addFor: Record<Tab, { label: string; open: () => void }> = {
    dashboard: { label: "New order", open: () => setEditing({ kind: "order", record: null }) },
    orders: { label: "New order", open: () => setEditing({ kind: "order", record: null }) },
    dispatch: { label: "New dispatch", open: () => setEditing({ kind: "dispatch", record: null }) },
    payments: { label: "Record payment", open: () => setEditing({ kind: "payment", record: null }) },
    customers: { label: "Add customer", open: () => setEditing({ kind: "customer", record: null }) },
  }

  const core = [orders, dispatches, payments, allOrders, summary]
  const loadError = core.find((q) => q.isError)
  const loading = core.some((q) => q.isPending)
  const dateToolbar = <DateFilter value={period} onChange={setPeriod} />

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Sales" description="Orders, dispatches, payments and customers."
        actions={<Button onClick={addFor[tab].open}><Plus className="size-4" /> {addFor[tab].label}</Button>} />

      {loadError ? (
        <ErrorState message={loadError.error!.message} onRetry={() => core.forEach((q) => q.refetch())} />
      ) : loading ? (
        <TableSkeleton columns={8} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="dispatch">Dispatches</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <SalesDashboard summary={summary.data!} orders={allOrders.data!} />
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <DataTable columns={orderColumns}
              data={orders.data!.filter((o) => (orderStatus === ALL || o.status === orderStatus) && (paymentStatus === ALL || o.payment_status === paymentStatus))}
              searchPlaceholder="Search buyer, fabric, quality…" emptyTitle="No orders" initialSorting={[{ id: "created_at", desc: true }]}
              toolbar={<>
                <Filter value={orderStatus} onChange={setOrderStatus} options={ORDER_STATUSES} label="Order status" allLabel="All statuses" />
                <Filter value={paymentStatus} onChange={setPaymentStatus} options={PAYMENT_STATUSES} label="Payment status" allLabel="All payments" />
                {dateToolbar}
              </>} />
          </TabsContent>

          <TabsContent value="dispatch" className="mt-4">
            <DataTable columns={dispatchColumns} data={dispatches.data!.filter((d) => dispatchStatus === ALL || d.dispatch_status === dispatchStatus)}
              searchPlaceholder="Search order, vehicle, driver…" emptyTitle="No dispatches" initialSorting={[{ id: "dispatch_date", desc: true }]}
              toolbar={<>
                <Filter value={dispatchStatus} onChange={setDispatchStatus} options={DISPATCH_STATUSES} label="Dispatch status" allLabel="All statuses" />
                {dateToolbar}
              </>} />
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <DataTable columns={paymentColumns} data={payments.data!.filter((p) => paymentMethod === ALL || p.payment_method === paymentMethod)}
              searchPlaceholder="Search order, reference, person…" emptyTitle="No payments" initialSorting={[{ id: "payment_date", desc: true }]}
              toolbar={<>
                <Filter value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHODS} label="Payment method" allLabel="All methods" />
                {dateToolbar}
              </>} />
          </TabsContent>

          <TabsContent value="customers" className="mt-4 space-y-4">
            {duplicates.data && duplicates.data.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                <p className="font-medium">Possible duplicates ({duplicates.data.length})</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {duplicates.data.slice(0, 5).map((d) => (
                    <li key={`${d.a.id}-${d.b.id}`}>“{d.a.name}” and “{d.b.name}” — {Math.round(d.similarity * 100)}% alike</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">Use “Merge into…” on a customer to combine them.</p>
              </div>
            )}
            {customers.isError ? <ErrorState message={customers.error.message} onRetry={() => customers.refetch()} />
              : customers.isPending ? <TableSkeleton columns={4} />
              : <DataTable columns={customerColumns} data={customers.data} searchPlaceholder="Search customers…" emptyTitle="No customers"
                  initialSorting={[{ id: "order_count", desc: true }]} />}
          </TabsContent>
        </Tabs>
      )}

      <OrderDialog open={editing?.kind === "order"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "order" ? editing.record : null} fabrics={fabrics.data ?? []} customers={customers.data ?? []} />
      <DispatchDialog open={editing?.kind === "dispatch"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "dispatch" ? editing.record : null} orderId={editing?.kind === "dispatch" ? editing.orderId : undefined}
        orders={allOrders.data ?? []} users={users.data ?? []} />
      <PaymentDialog open={editing?.kind === "payment"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "payment" ? editing.record : null} orders={allOrders.data ?? []} users={users.data ?? []} />
      <CustomerDialog open={editing?.kind === "customer"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "customer" ? editing.record : null} />
      <MergeDialog source={merging} customers={customers.data ?? []} onOpenChange={(o) => !o && setMerging(null)}
        onMerged={() => LISTS.forEach((key) => qc.invalidateQueries({ queryKey: key }))} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.kind ?? ""}?`}
        description={deleting?.kind === "dispatch"
          ? `“${deleting.label}” will be removed and its weight returned to stock.`
          : `“${deleting?.label}” will be removed. Records that depend on it can't be deleted.`}
        onConfirm={async () => {
          if (deleting) await removers[deleting.kind].mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
