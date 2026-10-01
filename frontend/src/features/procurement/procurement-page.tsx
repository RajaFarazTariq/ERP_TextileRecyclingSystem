"use client"

import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle, Ban, CalendarClock, Check, CheckCircle2, ClipboardCheck, FilePlus2, HandCoins, Lock, PackageOpen,
  Pencil, Plus, Receipt, Search, Send, ShoppingBag, Wallet, X,
} from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, dateParams, periodLabel } from "@/components/common/date-filter"
import { NameWithAvatar } from "@/components/common/identity"
import { ProgressBar } from "@/components/common/meters"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/features/auth/use-session"
import { VendorDialog } from "@/features/warehouse/warehouse-forms"
import { api } from "@/lib/api"
import { useAction, useDelete, useList } from "@/lib/crud"
import { date, kg, plural, rupees } from "@/lib/format"
import { cn } from "@/lib/utils"
import type {
  FactoryUnit, PriceComparison, ProcurementSummary, PurchaseOrder, PurchaseReturn, Requisition, StockEntry,
  SupplierInvoice, SupplierPayment, SupplierPerformance, SupplierQuotation, Vendor,
} from "@/types/api"
import {
  InvoiceDialog, OrderDialog, PaymentDialog, PROCUREMENT_LISTS, QuotationDialog, RejectDialog, RequisitionDialog,
  ReturnDialog,
} from "./procurement-forms"
import { INVOICE_STATUSES, ORDER_STATUSES, REQUISITION_STATUSES } from "./schemas"

type Tab = "dashboard" | "requests" | "orders" | "invoices" | "payments" | "returns" | "suppliers"
type Editing =
  | { kind: "requisition"; record: Requisition | null }
  | { kind: "order"; record: PurchaseOrder | null; from?: Requisition }
  | { kind: "invoice"; record: SupplierInvoice | null; from?: PurchaseOrder }
  | { kind: "payment"; record: SupplierPayment | null; invoice?: SupplierInvoice }
  | { kind: "return"; record: PurchaseReturn | null }
  | { kind: "quotation"; record: SupplierQuotation | null }
  | { kind: "vendor"; record: Vendor }
type Kind = "requisition" | "order" | "invoice" | "payment" | "return" | "quotation"
type Deleting = { kind: Kind; id: number; label: string }

const ALL = "all"
const n = (v: string | number | null | undefined) => Number(v) || 0
const isLate = (o: PurchaseOrder) =>
  !!o.expected_date && (o.status === "Approved" || o.status === "Partially Received") && o.expected_date < new Date().toISOString().slice(0, 10)

function StatusSelect({ value, onChange, options, label, allLabel = "All statuses" }: {
  value: string; onChange: (v: string) => void; options: readonly string[]; label: string; allLabel?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[170px]" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function Received({ order }: { order: PurchaseOrder }) {
  const ordered = n(order.ordered_kg)
  const received = n(order.received_kg)
  return (
    <div className="min-w-36 space-y-1.5">
      <ProgressBar value={ordered ? (received / ordered) * 100 : 0} size="sm" label={`${order.number} received`}
        tone={received >= ordered && ordered > 0 ? "success" : received > 0 ? "procurement" : "neutral"} />
      <p className="text-xs text-muted-foreground">{kg(received)} of {kg(ordered)}</p>
    </div>
  )
}

export function ProcurementPage() {
  const role = useSession().data?.role
  const admin = role === "admin"
  const [tab, setTab] = useState<Tab>("dashboard")
  const [reqStatus, setReqStatus] = useState(ALL)
  const [orderStatus, setOrderStatus] = useState(ALL)
  const [invoiceStatus, setInvoiceStatus] = useState(ALL)
  const [period, setPeriod] = useState<DateFilterValue>({ type: "all" })
  const [material, setMaterial] = useState("")
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const [rejecting, setRejecting] = useState<Requisition | null>(null)
  const [cancelling, setCancelling] = useState<PurchaseOrder | null>(null)

  const requisitions = useList<Requisition>("procurement/requisitions")
  const orders = useList<PurchaseOrder>("procurement/orders", dateParams(period))
  const allOrders = useList<PurchaseOrder>("procurement/orders")
  const invoices = useList<SupplierInvoice>("procurement/invoices")
  const payments = useList<SupplierPayment>("procurement/payments")
  const returns = useList<PurchaseReturn>("procurement/returns")
  const quotations = useList<SupplierQuotation>("procurement/quotations")
  const vendors = useList<Vendor>("warehouse/vendors")
  const units = useList<FactoryUnit>("warehouse/units")
  const deliveries = useList<StockEntry>("warehouse/stock")
  const summary = useQuery<ProcurementSummary>({ queryKey: ["procurement/summary"], queryFn: () => api("procurement/summary") })
  const performance = useQuery<SupplierPerformance[]>({
    queryKey: ["procurement/supplier-performance"], queryFn: () => api("procurement/supplier-performance"), enabled: tab === "suppliers",
  })
  const prices = useQuery<PriceComparison[]>({
    queryKey: ["procurement/price-comparison", material], enabled: tab === "suppliers",
    queryFn: () => api("procurement/price-comparison", { params: { material: material.trim() || undefined } }),
  })

  // `mutate` functions are stable, so the table columns below can depend on them
  const { mutate: submitRequest } = useAction("procurement/requisitions", "submit", { success: "Request sent for approval.", invalidate: PROCUREMENT_LISTS })
  const { mutate: approveRequest } = useAction("procurement/requisitions", "approve", { success: "Request approved.", invalidate: PROCUREMENT_LISTS })
  const { mutate: cancelRequest } = useAction("procurement/requisitions", "cancel", { success: "Request cancelled.", invalidate: PROCUREMENT_LISTS })
  const { mutate: submitOrder } = useAction("procurement/orders", "submit", { success: "Order sent for approval.", invalidate: PROCUREMENT_LISTS })
  const { mutate: approveOrder } = useAction("procurement/orders", "approve", { success: "Order approved.", invalidate: PROCUREMENT_LISTS })
  const { mutate: closeOrder } = useAction("procurement/orders", "close", { success: "Order closed.", invalidate: PROCUREMENT_LISTS })
  const cancelOrder = useAction("procurement/orders", "cancel", { success: "Order cancelled.", invalidate: PROCUREMENT_LISTS })
  const removers = {
    requisition: useDelete("procurement/requisitions", { noun: "Purchase request", invalidate: PROCUREMENT_LISTS }),
    order: useDelete("procurement/orders", { noun: "Purchase order", invalidate: PROCUREMENT_LISTS }),
    invoice: useDelete("procurement/invoices", { noun: "Invoice", invalidate: PROCUREMENT_LISTS }),
    payment: useDelete("procurement/payments", { noun: "Payment", invalidate: PROCUREMENT_LISTS }),
    return: useDelete("procurement/returns", { noun: "Return", invalidate: PROCUREMENT_LISTS }),
    quotation: useDelete("procurement/quotations", { noun: "Quote", invalidate: PROCUREMENT_LISTS }),
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const requisitionColumns = useMemo<TableColumn<Requisition>[]>(() => [
    { accessorKey: "number", header: "Request", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "requested_by_name", header: "Requested by", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { id: "materials", header: "Materials", accessorFn: (r) => r.lines.map((l) => l.material).join(", "),
      cell: ({ row }) => {
        const lines = row.original.lines
        return <span className="max-w-64 truncate">{lines.slice(0, 2).map((l) => l.material).join(", ")}{lines.length > 2 && ` +${lines.length - 2}`}</span>
      } },
    { id: "total_kg", header: "Quantity", accessorFn: (r) => n(r.total_kg), sortFn: "basic", cell: ({ row }) => kg(row.original.total_kg) },
    { id: "needed_by", header: "Needed by", accessorFn: (r) => (r.needed_by ? new Date(r.needed_by) : new Date(0)), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.needed_by ? date(row.original.needed_by) : "—"}</span> },
    { accessorKey: "status", header: "Status",
      cell: ({ row }) => (
        <span className="flex flex-col items-start gap-0.5" title={row.original.rejection_reason || undefined}>
          <StatusBadge status={row.original.status} />
          {row.original.status === "Rejected" && row.original.rejection_reason && (
            <span className="max-w-48 truncate text-xs text-muted-foreground">{row.original.rejection_reason}</span>
          )}
          {row.original.order_numbers.length > 0 && <span className="text-xs text-muted-foreground">{row.original.order_numbers.join(", ")}</span>}
        </span>
      ) },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const r = row.original
        const extra = []
        if (r.status === "Draft" || r.status === "Rejected") extra.push({ label: "Submit for approval", icon: <Send className="size-4" />, onSelect: () => submitRequest({ id: r.id }) })
        if (r.status === "Submitted" && admin) {
          extra.push({ label: "Approve", icon: <Check className="size-4" />, onSelect: () => approveRequest({ id: r.id }) })
          extra.push({ label: "Reject", icon: <X className="size-4" />, onSelect: () => setRejecting(r) })
        }
        if (r.status === "Approved") extra.push({ label: "Create order", icon: <FilePlus2 className="size-4" />, onSelect: () => setEditing({ kind: "order", record: null, from: r }) })
        if (!["Ordered", "Cancelled"].includes(r.status)) extra.push({ label: "Cancel request", icon: <Ban className="size-4" />, onSelect: () => cancelRequest({ id: r.id }) })
        const editable = r.status === "Draft" || r.status === "Rejected"
        return <RowActions extra={extra}
          onEdit={editable ? () => setEditing({ kind: "requisition", record: r }) : undefined}
          onDelete={["Draft", "Rejected", "Cancelled"].includes(r.status) ? () => setDeleting({ kind: "requisition", id: r.id, label: r.number }) : undefined} />
      } },
  ], [admin, submitRequest, approveRequest, cancelRequest])

  const orderColumns = useMemo<TableColumn<PurchaseOrder>[]>(() => [
    { accessorKey: "number", header: "Order",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.number}
          {row.original.revision > 0 && <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">Rev {row.original.revision}</span>}
        </span>
      ) },
    { accessorKey: "vendor_name", header: "Supplier", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { id: "order_date", header: "Ordered", accessorFn: (r) => new Date(r.order_date), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.order_date)}</span> },
    { id: "expected_date", header: "Expected", accessorFn: (r) => (r.expected_date ? new Date(r.expected_date) : new Date(0)), sortFn: "datetime",
      cell: ({ row }) => row.original.expected_date ? (
        <span className={cn("inline-flex items-center gap-1", isLate(row.original) ? "font-medium text-danger-fg" : "text-muted-foreground")}>
          {isLate(row.original) && <CalendarClock className="size-3.5" aria-label="Late" />}
          {date(row.original.expected_date)}
        </span>
      ) : <span className="text-muted-foreground">—</span> },
    { id: "total", header: "Amount", accessorFn: (r) => n(r.total_amount), sortFn: "basic",
      cell: ({ row }) => <span className="font-medium">{rupees(row.original.total_amount)}</span> },
    { id: "received", header: "Received", enableSorting: false, cell: ({ row }) => <Received order={row.original} /> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const o = row.original
        const extra = []
        if (o.status === "Draft") extra.push({ label: "Submit for approval", icon: <Send className="size-4" />, onSelect: () => submitOrder({ id: o.id }) })
        if (o.status === "Submitted" && admin) extra.push({ label: "Approve", icon: <Check className="size-4" />, onSelect: () => approveOrder({ id: o.id }) })
        if (o.status !== "Draft" && o.status !== "Cancelled") extra.push({ label: "Record invoice", icon: <Receipt className="size-4" />, onSelect: () => setEditing({ kind: "invoice", record: null, from: o }) })
        if (["Approved", "Partially Received", "Received"].includes(o.status) && admin) extra.push({ label: "Close order", icon: <Lock className="size-4" />, onSelect: () => closeOrder({ id: o.id }) })
        if (["Draft", "Submitted"].includes(o.status) || (o.status === "Approved" && n(o.received_kg) === 0)) extra.push({ label: "Cancel order", icon: <Ban className="size-4" />, onSelect: () => setCancelling(o) })
        const editable = ["Draft", "Submitted", "Approved", "Partially Received"].includes(o.status)
        return <RowActions extra={extra}
          onEdit={editable ? () => setEditing({ kind: "order", record: o }) : undefined}
          onDelete={["Draft", "Submitted", "Cancelled"].includes(o.status) ? () => setDeleting({ kind: "order", id: o.id, label: o.number }) : undefined} />
      } },
  ], [admin, submitOrder, approveOrder, closeOrder])

  const invoiceColumns = useMemo<TableColumn<SupplierInvoice>[]>(() => [
    { accessorKey: "vendor_name", header: "Supplier", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { accessorKey: "invoice_number", header: "Invoice no.", cell: ({ row }) => (
      <span><span className="font-medium">{row.original.invoice_number}</span>
        {row.original.order_number && <span className="block text-xs text-muted-foreground">{row.original.order_number}</span>}</span>
    ) },
    { id: "invoice_date", header: "Date", accessorFn: (r) => new Date(r.invoice_date), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.invoice_date)}</span> },
    { id: "due_date", header: "Due", accessorFn: (r) => (r.due_date ? new Date(r.due_date) : new Date(0)), sortFn: "datetime",
      cell: ({ row }) => row.original.due_date
        ? <span className={row.original.is_overdue ? "font-medium text-danger-fg" : "text-muted-foreground"}>{date(row.original.due_date)}{row.original.is_overdue && " · overdue"}</span>
        : <span className="text-muted-foreground">—</span> },
    { id: "total", header: "Total", accessorFn: (r) => n(r.total), sortFn: "basic", cell: ({ row }) => <span className="font-medium">{rupees(row.original.total)}</span> },
    { id: "paid", header: "Paid", enableSorting: false,
      cell: ({ row }) => (
        <div className="min-w-32 space-y-1.5">
          <ProgressBar value={n(row.original.total) ? (n(row.original.paid_amount) / n(row.original.total)) * 100 : 0} size="sm"
            tone={row.original.status === "Paid" ? "success" : "warning"} label={`Invoice ${row.original.invoice_number} paid`} />
          <p className="text-xs text-muted-foreground">{rupees(row.original.outstanding)} due</p>
        </div>
      ) },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} tone={getValue<string>() === "Unpaid" ? "warning" : undefined} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const inv = row.original
        return <RowActions
          extra={admin && inv.status !== "Paid" ? [{ label: "Record payment", icon: <Wallet className="size-4" />, onSelect: () => setEditing({ kind: "payment", record: null, invoice: inv }) }] : []}
          onEdit={() => setEditing({ kind: "invoice", record: inv })}
          onDelete={n(inv.paid_amount) === 0 ? () => setDeleting({ kind: "invoice", id: inv.id, label: `${inv.vendor_name} ${inv.invoice_number}` }) : undefined} />
      } },
  ], [admin])

  const paymentColumns = useMemo<TableColumn<SupplierPayment>[]>(() => [
    { id: "payment_date", header: "Date", accessorFn: (r) => new Date(r.payment_date), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.payment_date)}</span> },
    { accessorKey: "vendor_name", header: "Supplier", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { accessorKey: "invoice_number", header: "Invoice" },
    { id: "amount", header: "Amount", accessorFn: (r) => n(r.amount), sortFn: "basic", cell: ({ row }) => <span className="font-medium">{rupees(row.original.amount)}</span> },
    { accessorKey: "method", header: "Method" },
    { accessorKey: "reference", header: "Reference", cell: ({ getValue }) => getValue<string>() || "—" },
    { accessorKey: "paid_by_name", header: "Recorded by" },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => admin ? <RowActions onEdit={() => setEditing({ kind: "payment", record: row.original })}
        onDelete={() => setDeleting({ kind: "payment", id: row.original.id, label: `${rupees(row.original.amount)} to ${row.original.vendor_name}` })} /> : null },
  ], [admin])

  const returnColumns = useMemo<TableColumn<PurchaseReturn>[]>(() => [
    { accessorKey: "number", header: "Return", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "vendor_name", header: "Supplier", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { accessorKey: "receipt_label", header: "Delivery", cell: ({ row }) => (
      <span>{row.original.receipt_label}{row.original.order_number && <span className="block text-xs text-muted-foreground">{row.original.order_number}</span>}</span>
    ) },
    { id: "quantity", header: "Quantity", accessorFn: (r) => n(r.quantity_kg), sortFn: "basic", cell: ({ row }) => kg(row.original.quantity_kg) },
    { accessorKey: "reason", header: "Reason", cell: ({ getValue }) => <span className="block max-w-64 truncate" title={getValue<string>()}>{getValue<string>()}</span> },
    { id: "return_date", header: "Date", accessorFn: (r) => new Date(r.return_date), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.return_date)}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions onEdit={() => setEditing({ kind: "return", record: row.original })}
        onDelete={() => setDeleting({ kind: "return", id: row.original.id, label: row.original.number })} /> },
  ], [])

  const performanceColumns = useMemo<TableColumn<SupplierPerformance>[]>(() => [
    { accessorKey: "name", header: "Supplier",
      cell: ({ row }) => <NameWithAvatar name={row.original.name} sub={row.original.category || (row.original.is_active ? undefined : "Inactive")} /> },
    { accessorKey: "orders", header: "Orders", sortFn: "basic" },
    { accessorKey: "deliveries", header: "Deliveries", sortFn: "basic" },
    { id: "received_kg", header: "Received", accessorFn: (r) => n(r.received_kg), sortFn: "basic", cell: ({ row }) => kg(row.original.received_kg) },
    { id: "rejected_pct", header: "Rejected", accessorFn: (r) => r.rejected_pct ?? -1, sortFn: "basic",
      cell: ({ row }) => row.original.rejected_pct == null ? <span className="text-muted-foreground">—</span>
        : <span className={cn("font-medium", row.original.rejected_pct >= 10 ? "text-danger-fg" : row.original.rejected_pct >= 5 ? "text-warning-fg" : "text-success-fg")}>{row.original.rejected_pct}%</span> },
    { id: "on_time_pct", header: "On time", accessorFn: (r) => r.on_time_pct ?? -1, sortFn: "basic",
      cell: ({ row }) => row.original.on_time_pct == null ? <span className="text-muted-foreground">—</span> : `${row.original.on_time_pct}%` },
    { id: "avg_price", header: "Avg price/kg", accessorFn: (r) => n(r.avg_price_per_kg), sortFn: "basic",
      cell: ({ row }) => row.original.avg_price_per_kg == null ? <span className="text-muted-foreground">—</span> : rupees(row.original.avg_price_per_kg) },
    { id: "payable", header: "Payable", accessorFn: (r) => n(r.payable), sortFn: "basic",
      cell: ({ row }) => n(row.original.payable) ? <span className="font-medium">{rupees(row.original.payable)}</span> : <span className="text-muted-foreground">—</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const vendor = vendors.data?.find((v) => v.id === row.original.vendor)
        return vendor ? <RowActions extra={[{ label: "Edit profile", icon: <Pencil className="size-4" />, onSelect: () => setEditing({ kind: "vendor", record: vendor }) }]} /> : null
      } },
  ], [vendors.data])

  const quotationColumns = useMemo<TableColumn<SupplierQuotation>[]>(() => [
    { accessorKey: "vendor_name", header: "Supplier", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { accessorKey: "material", header: "Material" },
    { id: "price", header: "Price/kg", accessorFn: (r) => n(r.price_per_kg), sortFn: "basic", cell: ({ row }) => <span className="font-medium">{rupees(row.original.price_per_kg)}</span> },
    { id: "quoted_on", header: "Quoted", accessorFn: (r) => new Date(r.quoted_on), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.quoted_on)}</span> },
    { id: "valid_until", header: "Valid until", accessorFn: (r) => (r.valid_until ? new Date(r.valid_until) : new Date(8.64e15)), sortFn: "datetime",
      cell: ({ row }) => {
        const v = row.original.valid_until
        if (!v) return <span className="text-muted-foreground">Open</span>
        const expired = v < new Date().toISOString().slice(0, 10)
        return <span className={expired ? "text-faint line-through" : "text-muted-foreground"}>{date(v)}</span>
      } },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions onEdit={() => setEditing({ kind: "quotation", record: row.original })}
        onDelete={() => setDeleting({ kind: "quotation", id: row.original.id, label: `${row.original.vendor_name} · ${row.original.material}` })} /> },
  ], [])

  // ── Header action per tab ──────────────────────────────────────────────────

  const addFor: Record<Tab, { label: string; open: () => void } | null> = {
    dashboard: { label: "New order", open: () => setEditing({ kind: "order", record: null }) },
    requests: { label: "New request", open: () => setEditing({ kind: "requisition", record: null }) },
    orders: { label: "New order", open: () => setEditing({ kind: "order", record: null }) },
    invoices: { label: "Record invoice", open: () => setEditing({ kind: "invoice", record: null }) },
    payments: admin ? { label: "Record payment", open: () => setEditing({ kind: "payment", record: null }) } : null,
    returns: { label: "Record return", open: () => setEditing({ kind: "return", record: null }) },
    suppliers: { label: "Add quote", open: () => setEditing({ kind: "quotation", record: null }) },
  }

  const core = [requisitions, allOrders, invoices, summary, vendors]
  const loadError = core.find((q) => q.isError)
  const awaiting = [
    ...(requisitions.data ?? []).filter((r) => r.status === "Submitted").map((r) => ({ kind: "requisition" as const, item: r })),
    ...(allOrders.data ?? []).filter((o) => o.status === "Submitted").map((o) => ({ kind: "order" as const, item: o })),
  ]
  const openOrders = (allOrders.data ?? []).filter((o) => o.status === "Approved" || o.status === "Partially Received")
    .sort((a, b) => (a.expected_date ?? "9").localeCompare(b.expected_date ?? "9"))
  const s = summary.data
  const add = addFor[tab]

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Purchasing" icon="procurement"
        description="Purchase requests, orders, deliveries against orders, supplier invoices and payments."
        actions={add && <Button onClick={add.open}><Plus className="size-4" /> {add.label}</Button>} />

      {loadError ? (
        <ErrorState message={loadError.error!.message} onRetry={() => core.forEach((q) => q.refetch())} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4 space-y-6">
            {!s || !requisitions.data || !allOrders.data ? <CardsSkeleton /> : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Waiting for approval" icon={ClipboardCheck} tone="warning" value={s.pending_requisitions + s.pending_orders}
                    hint={`${plural(s.pending_requisitions, "request")} · ${plural(s.pending_orders, "order")}`} />
                  <StatCard label="Open orders" icon={ShoppingBag} tone="procurement" value={s.open_orders} hint={`${rupees(s.open_order_value)} on order`} />
                  <StatCard label="Late deliveries" icon={CalendarClock} tone={s.late_orders ? "danger" : "success"} value={s.late_orders}
                    hint="Past the expected date" muted={s.late_orders === 0} />
                  <StatCard label="Owed to suppliers" icon={HandCoins} tone="warning" value={rupees(s.payables)}
                    hint={s.overdue_invoices ? `${rupees(s.overdue_payables)} overdue on ${plural(s.overdue_invoices, "invoice")}` : `Spent ${rupees(s.spend_this_month)} this month`} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="animate-rise">
                    <CardHeader>
                      <CardTitle>Waiting for approval</CardTitle>
                      <CardDescription className="mt-0.5">{admin ? "Approve or reject each request" : "An admin approves these"}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {awaiting.length ? awaiting.map(({ kind, item }) => (
                        <div key={`${kind}-${item.id}`} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              {item.number}
                              <span className="ml-2 font-normal text-muted-foreground">
                                {kind === "order"
                                  ? `${(item as PurchaseOrder).vendor_name} · ${rupees((item as PurchaseOrder).total_amount)}${(item as PurchaseOrder).revision ? ` · amendment ${(item as PurchaseOrder).revision}` : ""}`
                                  : `${(item as Requisition).requested_by_name} · ${kg((item as Requisition).total_kg)}`}
                              </span>
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {kind === "order" ? (item as PurchaseOrder).lines.map((l) => l.material).join(", ") : (item as Requisition).lines.map((l) => l.material).join(", ")}
                            </p>
                          </div>
                          {admin ? (
                            <div className="flex gap-2">
                              {kind === "requisition" && (
                                <Button variant="outline" size="sm" onClick={() => setRejecting(item as Requisition)}><X className="size-3.5" /> Reject</Button>
                              )}
                              <Button size="sm" onClick={() => (kind === "order" ? approveOrder : approveRequest)({ id: item.id })}>
                                <Check className="size-3.5" /> Approve
                              </Button>
                            </div>
                          ) : <StatusBadge status="Submitted" tone="warning" />}
                        </div>
                      )) : (
                        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                          <CheckCircle2 className="size-4 text-success-fg" aria-hidden /> Nothing waiting for approval.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="animate-rise">
                    <CardHeader>
                      <CardTitle>Open orders</CardTitle>
                      <CardDescription className="mt-0.5">Deliveries still expected, soonest first</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {openOrders.length ? openOrders.slice(0, 6).map((o) => (
                        <div key={o.id} className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                              <span className="truncate"><span className="font-medium">{o.number}</span> <span className="text-muted-foreground">{o.vendor_name}</span></span>
                              <span className={cn("shrink-0 text-xs", isLate(o) ? "font-semibold text-danger-fg" : "text-muted-foreground")}>
                                {isLate(o) && <AlertTriangle className="mr-1 inline size-3" aria-hidden />}
                                {o.expected_date ? `due ${date(o.expected_date)}` : "no date"}
                              </span>
                            </div>
                            <ProgressBar value={n(o.ordered_kg) ? (n(o.received_kg) / n(o.ordered_kg)) * 100 : 0} size="sm" tone="procurement" label={`${o.number} received`} />
                            <p className="mt-1 text-xs text-muted-foreground">{kg(o.received_kg)} of {kg(o.ordered_kg)} received</p>
                          </div>
                        </div>
                      )) : <EmptyState icon={PackageOpen} title="No open orders" description="Approved orders waiting for delivery show here." />}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            {requisitions.isPending ? <TableSkeleton columns={7} /> : (
              <DataTable columns={requisitionColumns} exportName="purchase-requests"
                data={(requisitions.data ?? []).filter((r) => reqStatus === ALL || r.status === reqStatus)}
                searchPlaceholder="Search request, material, person…" emptyTitle="No purchase requests"
                emptyDescription="Ask for material with “New request”."
                filters={reqStatus !== ALL ? [{ label: `Status: ${reqStatus}`, onClear: () => setReqStatus(ALL) }] : []}
                toolbar={<StatusSelect value={reqStatus} onChange={setReqStatus} options={REQUISITION_STATUSES} label="Request status" />} />
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            {orders.isError ? <ErrorState message={orders.error.message} onRetry={() => orders.refetch()} />
              : orders.isPending ? <TableSkeleton columns={8} /> : (
                <DataTable columns={orderColumns} exportName="purchase-orders"
                  data={orders.data.filter((o) => orderStatus === ALL || o.status === orderStatus)}
                  searchPlaceholder="Search order, supplier…" emptyTitle="No purchase orders"
                  emptyDescription="Create one with “New order”, or from an approved request."
                  initialSorting={[{ id: "order_date", desc: true }]}
                  filters={[
                    ...(orderStatus !== ALL ? [{ label: `Status: ${orderStatus}`, onClear: () => setOrderStatus(ALL) }] : []),
                    ...(period.type !== "all" ? [{ label: `Period: ${periodLabel(period)}`, onClear: () => setPeriod({ type: "all" }) }] : []),
                  ]}
                  toolbar={<>
                    <StatusSelect value={orderStatus} onChange={setOrderStatus} options={ORDER_STATUSES} label="Order status" />
                    <DateFilter value={period} onChange={setPeriod} />
                  </>} />
              )}
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            {invoices.isPending ? <TableSkeleton columns={8} /> : (
              <DataTable columns={invoiceColumns} exportName="supplier-invoices"
                data={(invoices.data ?? []).filter((i) => invoiceStatus === ALL || i.status === invoiceStatus)}
                searchPlaceholder="Search supplier, invoice, order…" emptyTitle="No supplier invoices"
                initialSorting={[{ id: "invoice_date", desc: true }]}
                filters={invoiceStatus !== ALL ? [{ label: `Status: ${invoiceStatus}`, onClear: () => setInvoiceStatus(ALL) }] : []}
                toolbar={<StatusSelect value={invoiceStatus} onChange={setInvoiceStatus} options={INVOICE_STATUSES} label="Invoice status" />} />
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            {payments.isError ? <ErrorState message={payments.error.message} onRetry={() => payments.refetch()} />
              : payments.isPending ? <TableSkeleton columns={7} /> : (
                <DataTable columns={paymentColumns} data={payments.data} exportName="supplier-payments"
                  searchPlaceholder="Search supplier, invoice, reference…" emptyTitle="No supplier payments"
                  emptyDescription={admin ? "Record one from an invoice's menu." : "Admins record supplier payments."}
                  initialSorting={[{ id: "payment_date", desc: true }]} />
              )}
          </TabsContent>

          <TabsContent value="returns" className="mt-4">
            {returns.isError ? <ErrorState message={returns.error.message} onRetry={() => returns.refetch()} />
              : returns.isPending ? <TableSkeleton columns={7} /> : (
                <DataTable columns={returnColumns} data={returns.data} exportName="purchase-returns"
                  searchPlaceholder="Search supplier, reason…" emptyTitle="No returns"
                  emptyDescription="Record material sent back to a supplier." initialSorting={[{ id: "return_date", desc: true }]} />
              )}
          </TabsContent>

          <TabsContent value="suppliers" className="mt-4 space-y-6">
            <section className="space-y-3">
              <h2 className="font-heading text-base font-semibold">Supplier performance</h2>
              {performance.isError ? <ErrorState message={performance.error.message} onRetry={() => performance.refetch()} />
                : performance.isPending ? <TableSkeleton columns={8} /> : (
                  <DataTable columns={performanceColumns} data={performance.data} exportName="supplier-performance"
                    searchPlaceholder="Search suppliers…" emptyTitle="No suppliers yet" />
                )}
            </section>

            <div className="grid gap-4 xl:grid-cols-5">
              <Card className="animate-rise xl:col-span-2">
                <CardHeader>
                  <CardTitle>Price comparison</CardTitle>
                  <CardDescription className="mt-0.5">Quotes and past order prices per material, cheapest first</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Filter by material…"
                      aria-label="Filter prices by material" className="pl-9" />
                  </div>
                  {prices.isPending ? <TableSkeleton rows={3} columns={3} />
                    : prices.data?.length ? (
                      <div className="scrollbar-thin max-h-[28rem] space-y-4 overflow-y-auto pr-1">
                        {prices.data.map((m) => (
                          <div key={m.material} className="rounded-xl border p-3">
                            <p className="mb-2 font-medium">{m.material}</p>
                            <ul className="space-y-1.5">
                              {m.offers.map((o, i) => {
                                const best = o.best_quote ?? o.last_order_price
                                return (
                                  <li key={o.vendor} className="flex items-center gap-2 text-sm">
                                    <span className={cn("size-1.5 shrink-0 rounded-full", i === 0 ? "bg-success" : "bg-faint")} aria-hidden />
                                    <span className="min-w-0 flex-1 truncate">{o.vendor}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {o.best_quote != null ? "quote" : o.last_order_price != null ? `last of ${o.orders}` : ""}
                                    </span>
                                    <span className={cn("w-24 text-right font-semibold", i === 0 && "text-success-fg")}>{best != null ? rupees(best) : "—"}</span>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : <p className="py-4 text-sm text-muted-foreground">No prices yet. Add supplier quotes or place orders.</p>}
                </CardContent>
              </Card>

              <section className="space-y-3 xl:col-span-3">
                <h2 className="font-heading text-base font-semibold">Supplier quotes</h2>
                {quotations.isPending ? <TableSkeleton columns={5} /> : (
                  <DataTable columns={quotationColumns} data={quotations.data ?? []} exportName="supplier-quotes"
                    searchPlaceholder="Search supplier, material…" emptyTitle="No quotes yet" pageSize={10}
                    emptyDescription="Record prices suppliers offer with “Add quote”." />
                )}
              </section>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <RequisitionDialog open={editing?.kind === "requisition"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "requisition" ? editing.record : null} units={units.data ?? []} />
      <OrderDialog open={editing?.kind === "order"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "order" ? editing.record : null} fromRequisition={editing?.kind === "order" ? editing.from : null}
        vendors={vendors.data ?? []} requisitions={requisitions.data ?? []} />
      <InvoiceDialog open={editing?.kind === "invoice"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "invoice" ? editing.record : null} fromOrder={editing?.kind === "invoice" ? editing.from : null}
        vendors={vendors.data ?? []} orders={allOrders.data ?? []} />
      <PaymentDialog open={editing?.kind === "payment"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "payment" ? editing.record : null} forInvoice={editing?.kind === "payment" ? editing.invoice : null}
        invoices={invoices.data ?? []} />
      <ReturnDialog open={editing?.kind === "return"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "return" ? editing.record : null} deliveries={deliveries.data ?? []} />
      <QuotationDialog open={editing?.kind === "quotation"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "quotation" ? editing.record : null} vendors={vendors.data ?? []} />
      <VendorDialog open={editing?.kind === "vendor"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "vendor" ? editing.record : null} />
      <RejectDialog requisition={rejecting} onOpenChange={(o) => !o && setRejecting(null)} />

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title={`Cancel ${cancelling?.number}?`}
        description="The order can't receive deliveries afterwards. It stays on record as cancelled."
        confirmLabel="Cancel order"
        onConfirm={async () => {
          if (cancelling) await cancelOrder.mutateAsync({ id: cancelling.id })
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
