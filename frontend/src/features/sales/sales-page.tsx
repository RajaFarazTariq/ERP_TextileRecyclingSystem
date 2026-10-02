"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Ban, CheckCircle2, FilePlus2, FileText, GitMerge, PackageCheck, Plus, Printer, Send, ThumbsDown, ThumbsUp, Truck, Undo2,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, dateParams, periodLabel } from "@/components/common/date-filter"
import { NameWithAvatar, PlateChip } from "@/components/common/identity"
import { ProgressBar } from "@/components/common/meters"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { useAction, useDelete, useList } from "@/lib/crud"
import { date, kg, rupees } from "@/lib/format"
import type {
  Customer, CustomerDuplicate, Dispatch, FabricLot, Payment, Product, SalesInvoice, SalesOrder, SalesQuotation, SalesReturn,
  SalesSummary, UserSummary,
} from "@/types/api"
import {
  ConvertDialog, InvoiceDialog, PerformancePanel, ProductDialog, QuotationDialog, ReturnDialog, StatementSheet,
  printChallan, printInvoice, returnable, toInvoice,
} from "./sales-extras"
import { CustomerDialog, DispatchDialog, MergeDialog, OrderDialog, PaymentDialog, SALES_LISTS } from "./sales-forms"
import { SalesDashboard } from "./sales-dashboard"
import {
  DISPATCH_STATUSES, INVOICE_STATUSES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, QUOTATION_STATUSES, RETURN_STATUSES,
} from "./schemas"

type Tab = "dashboard" | "quotations" | "orders" | "dispatch" | "invoices" | "payments" | "returns" | "customers" | "products" | "performance"
type Kind = "order" | "dispatch" | "payment" | "customer" | "quotation" | "invoice" | "return" | "product"
type Editing =
  | { kind: "quotation"; record: SalesQuotation | null }
  | { kind: "return"; record: SalesReturn | null; orderId?: number }
  | { kind: "product"; record: Product | null }
  | { kind: "order"; record: SalesOrder | null }
  | { kind: "dispatch"; record: Dispatch | null; orderId?: number }
  | { kind: "payment"; record: Payment | null }
  | { kind: "customer"; record: Customer | null }
type Deleting = { kind: Kind; id: number; label: string }

const ALL = "all"
const n = (v: string | number | null | undefined) => Number(v) || 0
const LISTS = SALES_LISTS
const blocked = () => toast.error("The browser blocked the print window. Allow pop-ups for this site and try again.")

/** Payment status with how much of the order total has been paid. */
function PaymentCell({ order }: { order: SalesOrder }) {
  const total = n(order.total_price)
  const paid = order.payments.reduce((a, p) => a + n(p.amount), 0)
  const share = total > 0 ? Math.min(100, (paid / total) * 100) : 0
  return (
    <div className="flex min-w-32 flex-col gap-1.5" title={`${rupees(paid)} of ${rupees(total)} paid`}>
      <StatusBadge status={order.payment_status} />
      <ProgressBar value={share} size="sm" label={`Order ${order.id} amount paid`}
        tone={order.payment_status === "Paid" ? "success" : order.payment_status === "Partial" ? "warning" : "neutral"} className="w-24" />
    </div>
  )
}

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
  const [quotationStatus, setQuotationStatus] = useState(ALL)
  const [invoiceStatus, setInvoiceStatus] = useState(ALL)
  const [returnStatus, setReturnStatus] = useState(ALL)
  const [converting, setConverting] = useState<SalesQuotation | null>(null)
  const [invoicing, setInvoicing] = useState<SalesOrder | null>(null)
  const [statementOf, setStatementOf] = useState<Customer | null>(null)

  const periodParams = dateParams(period)
  const orders = useList<SalesOrder>("sales/orders", periodParams)
  const allOrders = useList<SalesOrder>("sales/orders")
  const dispatches = useList<Dispatch>("sales/dispatch", periodParams)
  const payments = useList<Payment>("sales/payments", periodParams)
  const customers = useList<Customer>("sales/customers")
  const fabrics = useList<FabricLot>("sorting/fabric-stock")
  const users = useList<UserSummary>("users/list")
  const quotations = useList<SalesQuotation>("sales/quotations", periodParams)
  const invoices = useList<SalesInvoice>("sales/invoices", periodParams)
  const returns = useList<SalesReturn>("sales/returns", periodParams)
  const products = useList<Product>("sales/products")
  const summary = useQuery<SalesSummary>({ queryKey: ["sales/orders/summary"], queryFn: () => api("sales/orders/summary") })
  const duplicates = useQuery<CustomerDuplicate[]>({
    queryKey: ["sales/customers", "duplicates"], queryFn: () => api("sales/customers/duplicates"), enabled: tab === "customers",
  })

  const { mutate: confirmOrder } = useAction("sales/orders", "confirm", { success: "Order confirmed; stock reserved.", invalidate: LISTS })
  const { mutate: sendQuotation } = useAction("sales/quotations", "send", { success: "Quotation marked as sent.", invalidate: LISTS })
  const { mutate: acceptQuotation } = useAction("sales/quotations", "accept", { success: "Quotation accepted.", invalidate: LISTS })
  const { mutate: rejectQuotation } = useAction("sales/quotations", "reject", { success: "Quotation rejected.", invalidate: LISTS })
  const { mutate: approveReturn } = useAction("sales/returns", "approve", { success: "Return approved; the customer is credited.", invalidate: LISTS })
  const { mutate: rejectReturn } = useAction("sales/returns", "reject", { success: "Return rejected.", invalidate: LISTS })
  const { mutate: cancelOrder } = useAction("sales/orders", "cancel", { success: "Order cancelled; reservation released.", invalidate: LISTS })
  const { mutate: markDelivered } = useAction("sales/dispatch", "mark_delivered", { success: "Marked as delivered; order completed.", invalidate: LISTS })

  const removers = {
    order: useDelete("sales/orders", { noun: "Order", invalidate: LISTS }),
    dispatch: useDelete("sales/dispatch", { noun: "Dispatch", invalidate: LISTS }),
    payment: useDelete("sales/payments", { noun: "Payment", invalidate: LISTS }),
    customer: useDelete("sales/customers", { noun: "Customer" }),
    quotation: useDelete("sales/quotations", { noun: "Quotation", invalidate: LISTS }),
    invoice: useDelete("sales/invoices", { noun: "Invoice", invalidate: LISTS }),
    return: useDelete("sales/returns", { noun: "Return", invalidate: LISTS }),
    product: useDelete("sales/products", { noun: "Product" }),
  }

  const buyerOf = useMemo(() => new Map((allOrders.data ?? []).map((o) => [o.id, o.buyer_name])), [allOrders.data])
  const orderOf = useMemo(() => new Map((allOrders.data ?? []).map((o) => [o.id, o])), [allOrders.data])

  const orderColumns = useMemo<TableColumn<SalesOrder>[]>(() => [
    { accessorKey: "id", header: "#", cell: ({ getValue }) => <span className="text-muted-foreground">#{getValue<number>()}</span> },
    { accessorKey: "buyer_name", header: "Buyer", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { accessorKey: "fabric_material", header: "Fabric" },
    { accessorKey: "fabric_quality", header: "Quality" },
    { id: "weight", header: "Weight", accessorFn: (r) => n(r.weight_sold), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.weight_sold)}</span> },
    { id: "price", header: "Price/kg", accessorFn: (r) => n(r.price_per_kg), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.price_per_kg)}</span> },
    { id: "total", header: "Total", accessorFn: (r) => n(r.total_price), sortFn: "basic", cell: ({ row }) => <span className="font-medium tabular-nums">{rupees(row.original.total_price)}</span> },
    { accessorKey: "payment_status", header: "Payment", cell: ({ row }) => <PaymentCell order={row.original} /> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "created_at", header: "Date", accessorFn: (r) => new Date(r.created_at), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.created_at)}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const o = row.original
        const extra = []
        if (o.status === "Draft") extra.push({ label: "Confirm", icon: <CheckCircle2 className="size-4" />, onSelect: () => confirmOrder({ id: o.id }, {
          // Over the credit limit: the order is confirmed, and the user is told
          onSuccess: (data) => {
            const warning = (data as { credit_warning?: string | null } | undefined)?.credit_warning
            if (warning) toast.warning(warning, { duration: 10000 })
          },
        }) })
        if (toInvoice(o) > 0) extra.push({ label: "Raise invoice", icon: <FilePlus2 className="size-4" />, onSelect: () => setInvoicing(o) })
        if (returnable(o) > 0) extra.push({ label: "Record return", icon: <Undo2 className="size-4" />, onSelect: () => setEditing({ kind: "return", record: null, orderId: o.id }) })
        if (o.status === "Confirmed" || o.status === "Dispatched") extra.push({ label: "Dispatch", icon: <Truck className="size-4" />, onSelect: () => setEditing({ kind: "dispatch", record: null, orderId: o.id }) })
        if (o.status === "Confirmed") extra.push({ label: "Cancel order", icon: <Ban className="size-4" />, onSelect: () => cancelOrder({ id: o.id }) })
        return <RowActions extra={extra} onEdit={() => setEditing({ kind: "order", record: o })}
          onDelete={() => setDeleting({ kind: "order", id: o.id, label: `Order #${o.id} (${o.buyer_name})` })} />
      } },
  ], [confirmOrder, cancelOrder])

  const dispatchColumns = useMemo<TableColumn<Dispatch>[]>(() => [
    { accessorKey: "id", header: "#", cell: ({ getValue }) => <span className="text-muted-foreground">#{getValue<number>()}</span> },
    { id: "order", header: "Order", accessorFn: (r) => r.order_buyer, cell: ({ row }) => <span className="font-medium">#{row.original.sales_order} {row.original.order_buyer}</span> },
    { accessorKey: "vehicle_number", header: "Vehicle", cell: ({ getValue }) => <PlateChip value={getValue<string>()} /> },
    { accessorKey: "driver_name", header: "Driver", cell: ({ getValue }) => getValue<string>() || "—" },
    { id: "weight", header: "Weight", accessorFn: (r) => n(r.dispatched_weight), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.dispatched_weight)}</span> },
    { accessorKey: "dispatch_status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { accessorKey: "challan_number", header: "Challan", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
    { id: "dispatch_date", header: "Date", accessorFn: (r) => new Date(r.dispatch_date), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.dispatch_date)}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const d = row.original
        return <RowActions
          extra={[
            ...(d.dispatch_status !== "Delivered" ? [{ label: "Mark delivered", icon: <PackageCheck className="size-4" />, onSelect: () => markDelivered({ id: d.id }) }] : []),
            { label: "Print challan", icon: <Printer className="size-4" />,
              onSelect: () => { if (!printChallan(d, orderOf.get(d.sales_order))) blocked() } },
          ]}
          onEdit={() => setEditing({ kind: "dispatch", record: d })}
          onDelete={() => setDeleting({ kind: "dispatch", id: d.id, label: `Dispatch #${d.id} (${d.vehicle_number})` })} />
      } },
  ], [markDelivered, orderOf])

  const paymentColumns = useMemo<TableColumn<Payment>[]>(() => [
    { accessorKey: "id", header: "#", cell: ({ getValue }) => <span className="text-muted-foreground">#{getValue<number>()}</span> },
    { id: "order", header: "Order", accessorFn: (r) => buyerOf.get(r.sales_order) ?? "", cell: ({ row }) => <span className="font-medium">#{row.original.sales_order} {buyerOf.get(row.original.sales_order) ?? ""}</span> },
    { id: "amount", header: "Amount", accessorFn: (r) => n(r.amount), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.amount)}</span> },
    { accessorKey: "payment_method", header: "Method" },
    { accessorKey: "reference_number", header: "Reference", cell: ({ getValue }) => getValue<string>() || "—" },
    { accessorKey: "received_by_name", header: "Received by", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { id: "payment_date", header: "Date", accessorFn: (r) => new Date(r.payment_date), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.payment_date)}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions onEdit={() => setEditing({ kind: "payment", record: row.original })}
        onDelete={() => setDeleting({ kind: "payment", id: row.original.id, label: `${rupees(row.original.amount)} for order #${row.original.sales_order}` })} /> },
  ], [buyerOf])

  const customerColumns = useMemo<TableColumn<Customer>[]>(() => [
    { accessorKey: "name", header: "Name", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { accessorKey: "contact", header: "Contact", cell: ({ getValue }) => getValue<string>() || "—" },
    { accessorKey: "category", header: "Category", cell: ({ getValue }) => getValue<string>() || <span className="text-muted-foreground">—</span> },
    { accessorKey: "order_count", header: "Orders", sortFn: "basic" },
    { id: "balance", header: "Owes", accessorFn: (r) => n(r.balance), sortFn: "basic",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="tabular-nums">{n(row.original.balance) ? rupees(row.original.balance) : <span className="text-muted-foreground">—</span>}</span>
          {row.original.over_limit && <Badge variant="destructive" title={`Credit limit ${rupees(row.original.credit_limit)}`}>Over limit</Badge>}
        </span>
      ) },
    { id: "created_at", header: "Since", accessorFn: (r) => new Date(r.created_at), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.created_at)}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions
        extra={[
          { label: "Statement", icon: <FileText className="size-4" />, onSelect: () => setStatementOf(row.original) },
          { label: "Merge into…", icon: <GitMerge className="size-4" />, onSelect: () => setMerging(row.original) },
        ]}
        onEdit={() => setEditing({ kind: "customer", record: row.original })}
        onDelete={() => setDeleting({ kind: "customer", id: row.original.id, label: row.original.name })} /> },
  ], [])

  const quotationColumns = useMemo<TableColumn<SalesQuotation>[]>(() => [
    { accessorKey: "number", header: "Number", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "customer_name", header: "Customer", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { id: "item", header: "Item", accessorFn: (r) => `${r.product_name ?? r.fabric_material ?? ""} ${r.fabric_quality}`,
      cell: ({ row }) => <span>{row.original.product_name ?? row.original.fabric_material ?? "—"} <span className="text-muted-foreground">{row.original.fabric_quality}</span></span> },
    { id: "weight", header: "Weight", accessorFn: (r) => n(r.weight), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.weight)}</span> },
    { id: "total", header: "Total", accessorFn: (r) => n(r.total), sortFn: "basic", cell: ({ row }) => <span className="font-medium tabular-nums">{rupees(row.original.total)}</span> },
    { id: "valid_until", header: "Valid until", accessorFn: (r) => r.valid_until ?? "",
      cell: ({ row }) => !row.original.valid_until ? <span className="text-muted-foreground">—</span>
        : row.original.expired ? <Badge variant="destructive">Expired {date(row.original.valid_until)}</Badge>
        : <span className="text-muted-foreground">{date(row.original.valid_until)}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <StatusBadge status={row.original.status} />
        {row.original.order && <span className="text-xs text-muted-foreground">Order #{row.original.order}</span>}
      </span>
    ) },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const q = row.original
        const open = q.status === "Draft" || q.status === "Sent"
        const extra = []
        if (q.status === "Draft") extra.push({ label: "Mark as sent", icon: <Send className="size-4" />, onSelect: () => sendQuotation({ id: q.id }) })
        if (open) extra.push({ label: "Customer accepted", icon: <ThumbsUp className="size-4" />, onSelect: () => acceptQuotation({ id: q.id }) })
        if (open) extra.push({ label: "Customer declined", icon: <ThumbsDown className="size-4" />, onSelect: () => rejectQuotation({ id: q.id }) })
        if (q.status === "Accepted") extra.push({ label: "Make order", icon: <FilePlus2 className="size-4" />, onSelect: () => setConverting(q) })
        return <RowActions extra={extra} onEdit={open ? () => setEditing({ kind: "quotation", record: q }) : undefined}
          onDelete={q.status !== "Converted" ? () => setDeleting({ kind: "quotation", id: q.id, label: `${q.number} (${q.customer_name})` }) : undefined} />
      } },
  ], [sendQuotation, acceptQuotation, rejectQuotation])

  const invoiceColumns = useMemo<TableColumn<SalesInvoice>[]>(() => [
    { accessorKey: "number", header: "Number", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "order", header: "Order", accessorFn: (r) => r.customer_name, cell: ({ row }) => <span>#{row.original.order} {row.original.customer_name}</span> },
    { id: "weight", header: "Weight", accessorFn: (r) => n(r.weight), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.weight)}</span> },
    { id: "total", header: "Total", accessorFn: (r) => n(r.total), sortFn: "basic", cell: ({ row }) => <span className="font-medium tabular-nums">{rupees(row.original.total)}</span> },
    { id: "due", header: "Still due", accessorFn: (r) => n(r.total) - n(r.paid), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{rupees(n(row.original.total) - n(row.original.paid))}</span> },
    { id: "invoice_date", header: "Date", accessorFn: (r) => new Date(r.invoice_date), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.invoice_date)}</span> },
    { id: "due_date", header: "Due", accessorFn: (r) => new Date(r.due_date), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.due_date)}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions
        extra={[{ label: "Print invoice", icon: <Printer className="size-4" />, onSelect: () => { if (!printInvoice(row.original)) blocked() } }]}
        onDelete={() => setDeleting({ kind: "invoice", id: row.original.id, label: `${row.original.number} (${row.original.customer_name})` })} /> },
  ], [])

  const returnColumns = useMemo<TableColumn<SalesReturn>[]>(() => [
    { accessorKey: "number", header: "Number", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "order", header: "Order", accessorFn: (r) => r.customer_name, cell: ({ row }) => <span>#{row.original.order} {row.original.customer_name}</span> },
    { id: "weight", header: "Weight", accessorFn: (r) => n(r.weight), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.weight)}</span> },
    { accessorKey: "reason", header: "Reason", cell: ({ getValue }) => <span className="line-clamp-1 max-w-64" title={getValue<string>()}>{getValue<string>()}</span> },
    { id: "restock", header: "Goods", accessorFn: (r) => (r.restock ? "Back into stock" : "Written off") },
    { id: "credit", header: "Credit", accessorFn: (r) => n(r.credit_amount), sortFn: "basic",
      cell: ({ row }) => n(row.original.credit_amount) ? <span className="tabular-nums">{rupees(row.original.credit_amount)}</span> : <span className="text-muted-foreground">—</span> },
    { id: "return_date", header: "Date", accessorFn: (r) => new Date(r.return_date), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.return_date)}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const r = row.original
        const pending = r.status === "Requested"
        return <RowActions
          extra={pending ? [
            { label: "Approve", icon: <ThumbsUp className="size-4" />, onSelect: () => approveReturn({ id: r.id }) },
            { label: "Reject", icon: <ThumbsDown className="size-4" />, onSelect: () => rejectReturn({ id: r.id }) },
          ] : []}
          onEdit={pending ? () => setEditing({ kind: "return", record: r }) : undefined}
          onDelete={r.status !== "Approved" ? () => setDeleting({ kind: "return", id: r.id, label: `${r.number} (${r.customer_name})` }) : undefined} />
      } },
  ], [approveReturn, rejectReturn])

  const productColumns = useMemo<TableColumn<Product>[]>(() => [
    { accessorKey: "name", header: "Product", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "material_type", header: "Material", cell: ({ getValue }) => getValue<string>() || <span className="text-muted-foreground">—</span> },
    { accessorKey: "grade", header: "Grade", cell: ({ getValue }) => getValue<string>() || <span className="text-muted-foreground">—</span> },
    { id: "price", header: "List price/kg", accessorFn: (r) => n(r.price_per_kg), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.price_per_kg)}</span> },
    { id: "prices", header: "Category prices", enableSorting: false, accessorFn: (r) => r.prices.map((p) => p.customer_category).join(" "),
      cell: ({ row }) => row.original.prices.length
        ? <span className="text-muted-foreground">{row.original.prices.map((p) => `${p.customer_category} ${rupees(p.price_per_kg)}`).join(", ")}</span>
        : <span className="text-muted-foreground">—</span> },
    { id: "status", header: "Status", accessorFn: (r) => (r.is_active ? "On sale" : "Not on sale"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "On sale" : "Not on sale"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions onEdit={() => setEditing({ kind: "product", record: row.original })}
        onDelete={() => setDeleting({ kind: "product", id: row.original.id, label: row.original.name })} /> },
  ], [])

  const addFor: Record<Tab, { label: string; open: () => void }> = {
    quotations: { label: "New quotation", open: () => setEditing({ kind: "quotation", record: null }) },
    invoices: { label: "New order", open: () => setEditing({ kind: "order", record: null }) },
    returns: { label: "Record return", open: () => setEditing({ kind: "return", record: null }) },
    products: { label: "New product", open: () => setEditing({ kind: "product", record: null }) },
    performance: { label: "New order", open: () => setEditing({ kind: "order", record: null }) },
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
  const periodChip = period.type !== "all" ? [{ label: `Period: ${periodLabel(period)}`, onClear: () => setPeriod({ type: "all" }) }] : []

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Sales" icon="sales" description="Quotations, orders, dispatches, invoices, payments, returns and customers."
        actions={<Button onClick={addFor[tab].open}><Plus className="size-4" /> {addFor[tab].label}</Button>} />

      {loadError ? (
        <ErrorState message={loadError.error!.message} onRetry={() => core.forEach((q) => q.refetch())} />
      ) : loading ? (
        <TableSkeleton columns={8} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="quotations">Quotations</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="dispatch">Dispatches</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <SalesDashboard summary={summary.data!} orders={allOrders.data!} />
          </TabsContent>

          <TabsContent value="quotations" className="mt-4">
            <DataTable columns={quotationColumns} data={(quotations.data ?? []).filter((q) => quotationStatus === ALL || q.status === quotationStatus)}
              searchPlaceholder="Search number, customer, item…" emptyTitle="No quotations" exportName="quotations"
              filters={[
                ...(quotationStatus !== ALL ? [{ label: `Status: ${quotationStatus}`, onClear: () => setQuotationStatus(ALL) }] : []),
                ...periodChip,
              ]}
              toolbar={<>
                <Filter value={quotationStatus} onChange={setQuotationStatus} options={QUOTATION_STATUSES} label="Quotation status" allLabel="All statuses" />
                {dateToolbar}
              </>} />
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <DataTable columns={invoiceColumns} data={(invoices.data ?? []).filter((i) => invoiceStatus === ALL || i.status === invoiceStatus)}
              searchPlaceholder="Search number, customer…" emptyTitle="No invoices" initialSorting={[{ id: "invoice_date", desc: true }]}
              emptyDescription="Raise an invoice from an order once goods are dispatched." exportName="sales-invoices"
              filters={[
                ...(invoiceStatus !== ALL ? [{ label: `Status: ${invoiceStatus}`, onClear: () => setInvoiceStatus(ALL) }] : []),
                ...periodChip,
              ]}
              toolbar={<>
                <Filter value={invoiceStatus} onChange={setInvoiceStatus} options={INVOICE_STATUSES} label="Invoice status" allLabel="All statuses" />
                {dateToolbar}
              </>} />
          </TabsContent>

          <TabsContent value="returns" className="mt-4">
            <DataTable columns={returnColumns} data={(returns.data ?? []).filter((r) => returnStatus === ALL || r.status === returnStatus)}
              searchPlaceholder="Search number, customer, reason…" emptyTitle="No returns" initialSorting={[{ id: "return_date", desc: true }]}
              exportName="sales-returns"
              filters={[
                ...(returnStatus !== ALL ? [{ label: `Status: ${returnStatus}`, onClear: () => setReturnStatus(ALL) }] : []),
                ...periodChip,
              ]}
              toolbar={<>
                <Filter value={returnStatus} onChange={setReturnStatus} options={RETURN_STATUSES} label="Return status" allLabel="All statuses" />
                {dateToolbar}
              </>} />
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <DataTable columns={productColumns} data={products.data ?? []} searchPlaceholder="Search products…" emptyTitle="No products"
              exportName="products" />
          </TabsContent>

          <TabsContent value="performance" className="mt-4">
            <PerformancePanel />
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <DataTable columns={orderColumns}
              data={orders.data!.filter((o) => (orderStatus === ALL || o.status === orderStatus) && (paymentStatus === ALL || o.payment_status === paymentStatus))}
              searchPlaceholder="Search buyer, fabric, quality…" emptyTitle="No orders" initialSorting={[{ id: "created_at", desc: true }]}
              exportName="sales-orders"
              filters={[
                ...(orderStatus !== ALL ? [{ label: `Status: ${orderStatus}`, onClear: () => setOrderStatus(ALL) }] : []),
                ...(paymentStatus !== ALL ? [{ label: `Payment: ${paymentStatus}`, onClear: () => setPaymentStatus(ALL) }] : []),
                ...periodChip,
              ]}
              toolbar={<>
                <Filter value={orderStatus} onChange={setOrderStatus} options={ORDER_STATUSES} label="Order status" allLabel="All statuses" />
                <Filter value={paymentStatus} onChange={setPaymentStatus} options={PAYMENT_STATUSES} label="Payment status" allLabel="All payments" />
                {dateToolbar}
              </>} />
          </TabsContent>

          <TabsContent value="dispatch" className="mt-4">
            <DataTable columns={dispatchColumns} data={dispatches.data!.filter((d) => dispatchStatus === ALL || d.dispatch_status === dispatchStatus)}
              searchPlaceholder="Search order, vehicle, driver…" emptyTitle="No dispatches" initialSorting={[{ id: "dispatch_date", desc: true }]}
              exportName="dispatches"
              filters={[
                ...(dispatchStatus !== ALL ? [{ label: `Status: ${dispatchStatus}`, onClear: () => setDispatchStatus(ALL) }] : []),
                ...periodChip,
              ]}
              toolbar={<>
                <Filter value={dispatchStatus} onChange={setDispatchStatus} options={DISPATCH_STATUSES} label="Dispatch status" allLabel="All statuses" />
                {dateToolbar}
              </>} />
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <DataTable columns={paymentColumns} data={payments.data!.filter((p) => paymentMethod === ALL || p.payment_method === paymentMethod)}
              searchPlaceholder="Search order, reference, person…" emptyTitle="No payments" initialSorting={[{ id: "payment_date", desc: true }]}
              exportName="payments"
              filters={[
                ...(paymentMethod !== ALL ? [{ label: `Method: ${paymentMethod}`, onClear: () => setPaymentMethod(ALL) }] : []),
                ...periodChip,
              ]}
              toolbar={<>
                <Filter value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHODS} label="Payment method" allLabel="All methods" />
                {dateToolbar}
              </>} />
          </TabsContent>

          <TabsContent value="customers" className="mt-4 space-y-4">
            {duplicates.data && duplicates.data.length > 0 && (
              <div className="rounded-xl border border-warning/30 bg-warning/8 p-4 text-sm">
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
              : <DataTable columns={customerColumns} data={customers.data} searchPlaceholder="Search customers…" emptyTitle="No customers" exportName="customers"
                  initialSorting={[{ id: "order_count", desc: true }]} />}
          </TabsContent>
        </Tabs>
      )}

      <OrderDialog open={editing?.kind === "order"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "order" ? editing.record : null} fabrics={fabrics.data ?? []} customers={customers.data ?? []}
        products={products.data ?? []} />
      <QuotationDialog open={editing?.kind === "quotation"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "quotation" ? editing.record : null} customers={customers.data ?? []}
        products={products.data ?? []} fabrics={fabrics.data ?? []} />
      <ConvertDialog quotation={converting} fabrics={fabrics.data ?? []} onOpenChange={(o) => !o && setConverting(null)}
        onDone={() => {
          toast.success("Order created as a Draft.")
          LISTS.forEach((key) => qc.invalidateQueries({ queryKey: key }))
        }} />
      <InvoiceDialog order={invoicing} onOpenChange={(o) => !o && setInvoicing(null)} />
      <ReturnDialog open={editing?.kind === "return"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "return" ? editing.record : null} orderId={editing?.kind === "return" ? editing.orderId : undefined}
        orders={allOrders.data ?? []} />
      <ProductDialog open={editing?.kind === "product"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "product" ? editing.record : null} />
      <StatementSheet customer={statementOf} onOpenChange={(o) => !o && setStatementOf(null)} />
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
