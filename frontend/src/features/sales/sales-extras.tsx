"use client"

// Quotations, the price list, invoices, returns, customer statements and the performance report.
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Coins, FileCheck2, Plus, Scale, ShoppingCart, Trash2, Undo2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { axisProps, ChartCard, ChartGradient, ChartTooltip, cursorProps, gridProps, yAxisProps } from "@/components/common/chart"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, dateParams } from "@/components/common/date-filter"
import { Field, FieldGroup, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { StatCard } from "@/components/common/stat-card"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { today } from "@/features/procurement/schemas"
import { api } from "@/lib/api"
import { useSave } from "@/lib/crud"
import { date, kg, percent, plural, rupees } from "@/lib/format"
import { applyServerErrors } from "@/lib/forms"
import { cn } from "@/lib/utils"
import type {
  Customer, CustomerStatement, Dispatch, FabricLot, PerformanceRow, Product, SalesInvoice, SalesOrder, SalesPerformance,
  SalesQuotation, SalesReturn,
} from "@/types/api"
import { priceFor, SALES_LISTS } from "./sales-forms"
import {
  CUSTOMER_CATEGORIES, type InvoiceForm, type ProductForm, type QuotationForm, type ReturnForm,
  invoiceSchema, previewTotal, productSchema, quotationSchema, returnSchema,
} from "./schemas"

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

const n = (v: string | number | null | undefined) => Number(v) || 0
const amount = (v: string | number | null | undefined) => n(v).toLocaleString("en-PK", { maximumFractionDigits: 2 })
const orNull = (v: string) => (v ? v : null)
const orderLabel = (o: SalesOrder) => `#${o.id} — ${o.buyer_name} (${kg(o.weight_sold)})`
const shipped = (o: SalesOrder) => o.dispatches.reduce((a, d) => a + n(d.dispatched_weight), 0)

/** Dispatched weight of an order that has not been invoiced yet. */
export const toInvoice = (o: SalesOrder) => Math.round((shipped(o) - n(o.invoiced_weight)) * 100) / 100
/** Dispatched weight of an order that is not already on a return. */
export const returnable = (o: SalesOrder) => Math.round((shipped(o) - n(o.returned_weight)) * 100) / 100

// ─── Quotation ──────────────────────────────────────────────────────────────

type QuotationDialogProps = DialogProps<SalesQuotation> & { customers: Customer[]; products: Product[]; fabrics: FabricLot[] }

export function QuotationDialog(props: QuotationDialogProps) {
  return props.open ? <QuotationDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function QuotationDialogBody({ open, onOpenChange, record, customers, products, fabrics }: QuotationDialogProps) {
  const save = useSave<SalesQuotation>("sales/quotations", { noun: "Quotation", invalidate: SALES_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<QuotationForm>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      customer: record ? String(record.customer) : "",
      product: record?.product ? String(record.product) : "",
      fabric: record?.fabric ? String(record.fabric) : "",
      fabric_quality: record?.fabric_quality ?? "",
      weight: record?.weight ?? "",
      price_per_kg: record?.price_per_kg ?? "",
      discount_pct: record && n(record.discount_pct) ? record.discount_pct : "",
      tax_pct: record && n(record.tax_pct) ? record.tax_pct : "",
      valid_until: record?.valid_until ?? "",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const [customerId, weight, price, discount, tax] = useWatch({
    control: form.control, name: ["customer", "weight", "price_per_kg", "discount_pct", "tax_pct"],
  })
  const total = previewTotal(weight, price, discount, tax)

  const applyProduct = (id: string) => {
    form.setValue("product", id)
    const product = products.find((p) => String(p.id) === id)
    if (!product) return
    if (product.grade) form.setValue("fabric_quality", product.grade, { shouldValidate: true })
    form.setValue("price_per_kg", priceFor(product, customers.find((c) => String(c.id) === customerId)), { shouldValidate: true })
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values, customer: Number(values.customer), product: values.product ? Number(values.product) : null,
          fabric: values.fabric ? Number(values.fabric) : null, valid_until: orNull(values.valid_until),
          discount_pct: values.discount_pct || "0", tax_pct: values.tax_pct || "0",
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.number}` : "New quotation"}
      description="An offer to a customer. Once they accept, it becomes a sales order with the same terms."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="quotation-customer" label="Customer" error={errors.customer?.message}>
          <Controller control={form.control} name="customer" render={({ field }) => (
            <SelectField id="quotation-customer" value={field.value} onChange={field.onChange} invalid={!!errors.customer} placeholder="Select customer"
              options={customers.filter((c) => c.is_active || c.id === record?.customer).map((c) => ({ value: String(c.id), label: c.name }))} />
          )} />
        </Field>
        <Field id="quotation-product" label="Product" hint="Optional: fills in the quality and price">
          <Controller control={form.control} name="product" render={({ field }) => (
            <SelectField id="quotation-product" value={field.value} onChange={applyProduct} placeholder="None" allowNone="None"
              options={products.filter((p) => p.is_active || p.id === record?.product).map((p) => ({ value: String(p.id), label: p.name }))} />
          )} />
        </Field>
      </div>
      <Field id="quotation-fabric" label="Fabric lot" hint="Optional now; needed when the order is made">
        <Controller control={form.control} name="fabric" render={({ field }) => (
          <SelectField id="quotation-fabric" value={field.value} onChange={field.onChange} placeholder="Decide later" allowNone="Decide later"
            options={fabrics.map((f) => ({ value: String(f.id), label: `${f.material_type} — ${kg(f.dried_available_kg)} available` }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="quotation-quality" label="Quality" error={errors.fabric_quality?.message}>
          <Input id="quotation-quality" placeholder="e.g. Grade A" aria-invalid={!!errors.fabric_quality} {...form.register("fabric_quality")} />
        </Field>
        <Field id="quotation-weight" label="Weight (kg)" error={errors.weight?.message}>
          <Input id="quotation-weight" inputMode="decimal" aria-invalid={!!errors.weight} {...form.register("weight")} />
        </Field>
        <Field id="quotation-price" label="Price per kg (Rs.)" error={errors.price_per_kg?.message}>
          <Input id="quotation-price" inputMode="decimal" aria-invalid={!!errors.price_per_kg} {...form.register("price_per_kg")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="quotation-discount" label="Discount, %" error={errors.discount_pct?.message}>
          <Input id="quotation-discount" inputMode="decimal" aria-invalid={!!errors.discount_pct} {...form.register("discount_pct")} />
        </Field>
        <Field id="quotation-tax" label="Tax, %" error={errors.tax_pct?.message}>
          <Input id="quotation-tax" inputMode="decimal" aria-invalid={!!errors.tax_pct} {...form.register("tax_pct")} />
        </Field>
        <Field id="quotation-valid" label="Valid until">
          <Input id="quotation-valid" type="date" {...form.register("valid_until")} />
        </Field>
      </div>
      {Number.isFinite(total) && total > 0 && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">Total: <span className="font-semibold tabular-nums">{rupees(total)}</span></p>
      )}
      <Field id="quotation-notes" label="Notes">
        <Textarea id="quotation-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

/** Turns an accepted quotation into a Draft order, asking for the fabric lot if it has none. */
export function ConvertDialog({ quotation, fabrics, onOpenChange, onDone }: {
  quotation: SalesQuotation | null; fabrics: FabricLot[]; onOpenChange: (open: boolean) => void; onDone: () => void
}) {
  return quotation ? <ConvertDialogBody key={quotation.id} quotation={quotation} fabrics={fabrics} onOpenChange={onOpenChange} onDone={onDone} /> : null
}

function ConvertDialogBody({ quotation, fabrics, onOpenChange, onDone }: {
  quotation: SalesQuotation; fabrics: FabricLot[]; onOpenChange: (open: boolean) => void; onDone: () => void
}) {
  const [fabric, setFabric] = useState(quotation.fabric ? String(quotation.fabric) : "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <FormDialog open onOpenChange={onOpenChange} title={`Make an order from ${quotation.number}`}
      description={`${quotation.customer_name} · ${kg(quotation.weight)} at ${rupees(quotation.price_per_kg)} per kg · ${rupees(quotation.total)}. The order starts as a Draft; confirming it reserves the stock.`}
      error={error} submitting={busy} submitLabel="Create order"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!fabric) return setError("Choose the fabric lot to sell from.")
        setBusy(true)
        setError("")
        try {
          await api(`sales/quotations/${quotation.id}/convert`, { method: "POST", body: { fabric: Number(fabric) } })
          onDone()
          onOpenChange(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not create the order.")
        } finally {
          setBusy(false)
        }
      }}>
      <Field id="convert-fabric" label="Fabric lot">
        <SelectField id="convert-fabric" value={fabric} onChange={setFabric} placeholder="Select fabric lot"
          options={fabrics.map((f) => ({ value: String(f.id), label: `${f.material_type} — ${kg(f.dried_available_kg)} available` }))} />
      </Field>
    </FormDialog>
  )
}

// ─── Product and its price list ─────────────────────────────────────────────

export function ProductDialog(props: DialogProps<Product>) {
  return props.open ? <ProductDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function ProductDialogBody({ open, onOpenChange, record }: DialogProps<Product>) {
  const save = useSave<Product>("sales/products", { noun: "Product" })
  const [formError, setFormError] = useState("")
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: record?.name ?? "",
      material_type: record?.material_type ?? "",
      grade: record?.grade ?? "",
      specification: record?.specification ?? "",
      price_per_kg: record?.price_per_kg ?? "",
      is_active: record && !record.is_active ? "no" : "yes",
      prices: record?.prices.map((p) => ({ customer_category: p.customer_category, price_per_kg: p.price_per_kg })) ?? [],
    },
  })
  const prices = useFieldArray({ control: form.control, name: "prices" })
  const { errors, isSubmitting } = form.formState
  const used = useWatch({ control: form.control, name: "prices" }).map((p) => p.customer_category)
  const nextCategory = CUSTOMER_CATEGORIES.find((c) => !used.includes(c))

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, is_active: values.is_active === "yes" } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New product"}
      description="What you sell, with its list price. A customer category can have its own price."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <Field id="product-name" label="Name" error={errors.name?.message}>
        <Input id="product-name" placeholder="e.g. White recycled fibre A" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="product-material" label="Material"><Input id="product-material" placeholder="e.g. Cotton" {...form.register("material_type")} /></Field>
        <Field id="product-grade" label="Grade"><Input id="product-grade" placeholder="e.g. Grade A" {...form.register("grade")} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="product-price" label="List price per kg (Rs.)" error={errors.price_per_kg?.message}>
          <Input id="product-price" inputMode="decimal" aria-invalid={!!errors.price_per_kg} {...form.register("price_per_kg")} />
        </Field>
        <Field id="product-active" label="Status">
          <Controller control={form.control} name="is_active" render={({ field }) => (
            <SelectField id="product-active" value={field.value} onChange={field.onChange} placeholder="Select status"
              options={[{ value: "yes", label: "On sale" }, { value: "no", label: "Not on sale" }]} />
          )} />
        </Field>
      </div>
      <Field id="product-specification" label="Specification">
        <Textarea id="product-specification" rows={2} placeholder="e.g. Fibre length, whiteness, moisture" {...form.register("specification")} />
      </Field>
      <FieldGroup title="Prices by customer category">
        {prices.fields.map((row, i) => (
          <div key={row.id} className="space-y-1">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
              <Controller control={form.control} name={`prices.${i}.customer_category`} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="col-span-full w-full sm:col-span-1" aria-label={`Category ${i + 1}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{CUSTOMER_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              )} />
              <Input aria-label={`Price ${i + 1}`} placeholder="Rs. per kg" inputMode="decimal" aria-invalid={!!errors.prices?.[i]?.price_per_kg}
                {...form.register(`prices.${i}.price_per_kg`)} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove price ${i + 1}`} onClick={() => prices.remove(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            {errors.prices?.[i]?.price_per_kg && <p className="text-[13px] text-destructive">{errors.prices[i]?.price_per_kg?.message}</p>}
          </div>
        ))}
        {!prices.fields.length && <p className="text-sm text-muted-foreground">Every customer pays the list price.</p>}
        {nextCategory && (
          <Button type="button" variant="outline" className="w-fit" onClick={() => prices.append({ customer_category: nextCategory, price_per_kg: "" })}>
            <Plus className="size-4" /> Add category price
          </Button>
        )}
        {errors.prices?.root?.message && <p className="text-[13px] text-destructive">{errors.prices.root.message}</p>}
      </FieldGroup>
    </FormDialog>
  )
}

// ─── Invoice (raised from an order) ─────────────────────────────────────────

export function InvoiceDialog({ order, onOpenChange }: { order: SalesOrder | null; onOpenChange: (open: boolean) => void }) {
  return order ? <InvoiceDialogBody key={order.id} order={order} onOpenChange={onOpenChange} /> : null
}

function InvoiceDialogBody({ order, onOpenChange }: { order: SalesOrder; onOpenChange: (open: boolean) => void }) {
  const save = useSave<SalesInvoice>(`sales/orders/${order.id}/invoice`, { noun: "Invoice", invalidate: SALES_LISTS })
  const [formError, setFormError] = useState("")
  const open = toInvoice(order)
  const form = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema), defaultValues: { weight: open.toFixed(2), invoice_date: today(), notes: "" },
  })
  const { errors, isSubmitting } = form.formState
  const weight = useWatch({ control: form.control, name: "weight" })
  const total = previewTotal(weight, order.price_per_kg, order.discount_pct, order.tax_pct)

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ body: values })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open onOpenChange={onOpenChange} title={`Invoice order #${order.id}`}
      description={`${order.buyer_name} · ${kg(open)} dispatched and not yet invoiced, at ${rupees(order.price_per_kg)} per kg.`}
      error={formError} submitting={isSubmitting} submitLabel="Raise invoice" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="invoice-weight" label="Weight (kg)" error={errors.weight?.message}>
          <Input id="invoice-weight" inputMode="decimal" aria-invalid={!!errors.weight} {...form.register("weight")} />
        </Field>
        <Field id="invoice-date" label="Invoice date" error={errors.invoice_date?.message}>
          <Input id="invoice-date" type="date" aria-invalid={!!errors.invoice_date} {...form.register("invoice_date")} />
        </Field>
      </div>
      {Number.isFinite(total) && total > 0 && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">Invoice total: <span className="font-semibold tabular-nums">{rupees(total)}</span></p>
      )}
      <Field id="invoice-notes" label="Notes"><Textarea id="invoice-notes" rows={2} {...form.register("notes")} /></Field>
    </FormDialog>
  )
}

// ─── Return ─────────────────────────────────────────────────────────────────

type ReturnDialogProps = DialogProps<SalesReturn> & { orders: SalesOrder[]; orderId?: number }

export function ReturnDialog(props: ReturnDialogProps) {
  return props.open ? <ReturnDialogBody key={props.record?.id ?? `new-${props.orderId ?? ""}`} {...props} /> : null
}

function ReturnDialogBody({ open, onOpenChange, record, orders, orderId }: ReturnDialogProps) {
  const save = useSave<SalesReturn>("sales/returns", { noun: "Return", invalidate: SALES_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<ReturnForm>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      order: record ? String(record.order) : orderId ? String(orderId) : "",
      return_date: record?.return_date ?? today(),
      weight: record?.weight ?? "",
      reason: record?.reason ?? "",
      restock: record?.restock ? "yes" : "no",
    },
  })
  const { errors, isSubmitting } = form.formState
  const chosenId = useWatch({ control: form.control, name: "order" })
  const chosen = orders.find((o) => String(o.id) === chosenId)
  const left = chosen ? returnable(chosen) + (record && record.order === chosen.id ? n(record.weight) : 0) : 0

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, order: Number(values.order), restock: values.restock === "yes" } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.number}` : "Record a return"}
      description="Goods a customer sends back. Nothing changes until an admin approves it: then the customer is credited and, if you choose, the weight goes back into stock."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="return-order" label="Order" error={errors.order?.message} hint={chosen ? `${kg(left)} can be returned` : undefined}>
        <Controller control={form.control} name="order" render={({ field }) => (
          <SelectField id="return-order" value={field.value} onChange={field.onChange} invalid={!!errors.order} placeholder="Select order"
            options={orders.filter((o) => shipped(o) > 0).map((o) => ({ value: String(o.id), label: orderLabel(o) }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="return-weight" label="Weight (kg)" error={errors.weight?.message}>
          <Input id="return-weight" inputMode="decimal" aria-invalid={!!errors.weight} {...form.register("weight")} />
        </Field>
        <Field id="return-date" label="Return date" error={errors.return_date?.message}>
          <Input id="return-date" type="date" aria-invalid={!!errors.return_date} {...form.register("return_date")} />
        </Field>
      </div>
      <Field id="return-restock" label="What happens to the goods">
        <Controller control={form.control} name="restock" render={({ field }) => (
          <SelectField id="return-restock" value={field.value} onChange={field.onChange} placeholder="Select"
            options={[{ value: "no", label: "Written off (not sellable)" }, { value: "yes", label: "Back into sellable stock" }]} />
        )} />
      </Field>
      <Field id="return-reason" label="Reason" error={errors.reason?.message}>
        <Textarea id="return-reason" rows={2} placeholder="e.g. Bales arrived damp" aria-invalid={!!errors.reason} {...form.register("reason")} />
      </Field>
    </FormDialog>
  )
}

// ─── Customer statement ─────────────────────────────────────────────────────

export function StatementSheet({ customer, onOpenChange }: { customer: Customer | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={!!customer} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 bg-elevated p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {customer && <StatementBody key={customer.id} customer={customer} />}
      </SheetContent>
    </Sheet>
  )
}

function StatementBody({ customer }: { customer: Customer }) {
  const query = useQuery<CustomerStatement>({
    queryKey: ["sales/customers", customer.id, "statement"], queryFn: () => api(`sales/customers/${customer.id}/statement`),
  })
  const data = query.data
  const figures: [string, string, string?][] = data ? [
    ["Billed", rupees(data.billed)], ["Paid", rupees(data.paid)], ["Return credits", rupees(data.credited)],
    ["Balance owed", rupees(data.balance), data.over_limit ? "text-danger-fg" : undefined],
    ["Overdue", rupees(data.overdue), n(data.overdue) ? "text-warning-fg" : undefined],
    ["Credit limit", n(data.credit_limit) ? rupees(data.credit_limit) : "None"],
  ] : []

  return (
    <>
      <SheetHeader className="border-b px-6 pt-5 pb-4">
        <SheetTitle className="font-heading text-lg font-semibold tracking-tight">Statement: {customer.name}</SheetTitle>
        <SheetDescription>Confirmed orders, payments and return credits, oldest first.</SheetDescription>
      </SheetHeader>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {query.isError ? <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
          : !data ? <TableSkeleton columns={4} />
          : (
            <>
              {data.over_limit && (
                <p className="rounded-md border border-warning/30 bg-warning/8 px-3 py-2 text-sm">
                  This customer is over their credit limit. New orders can still be confirmed.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {figures.map(([label, value, tone]) => (
                  <div key={label} className="rounded-lg border px-3 py-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={cn("font-medium tabular-nums", tone)}>{value}</p>
                  </div>
                ))}
              </div>
              {data.transactions.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                        <th>Date</th><th>Entry</th><th className="text-right">Billed</th><th className="text-right">Received</th><th className="text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {data.transactions.map((t, i) => (
                        <tr key={i} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2">
                          <td className="whitespace-nowrap text-muted-foreground">{date(t.date)}</td>
                          <td><span className="font-medium">{t.kind}</span> <span className="text-muted-foreground">{t.reference} · {t.detail}</span></td>
                          <td className="text-right">{n(t.debit) ? amount(t.debit) : ""}</td>
                          <td className="text-right">{n(t.credit) ? amount(t.credit) : ""}</td>
                          <td className="text-right font-medium">{amount(t.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">No confirmed orders or payments yet.</p>}
            </>
          )}
      </div>
    </>
  )
}

// ─── Performance report ─────────────────────────────────────────────────────

export function PerformancePanel() {
  const [period, setPeriod] = useState<DateFilterValue>({ type: "this_year" })
  const params = dateParams(period)
  const report = useQuery<SalesPerformance>({ queryKey: ["sales/performance", params], queryFn: () => api("sales/performance", { params }) })

  const columns = useMemo<TableColumn<PerformanceRow>[]>(() => [
    { accessorKey: "name", header: "Name", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "orders", header: "Orders", sortFn: "basic", cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
    { id: "kg", header: "Weight", accessorFn: (r) => n(r.kg), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{kg(row.original.kg)}</span> },
    { id: "revenue", header: "Sales", accessorFn: (r) => n(r.revenue), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.revenue)}</span> },
  ], [])

  const data = report.data
  const months = (data?.by_month ?? []).map((m) => ({
    month: new Date(`${m.name}-01`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), revenue: n(m.revenue),
  }))
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DateFilter value={period} onChange={setPeriod} />
        <span className="text-sm text-muted-foreground">Orders that are confirmed, dispatched or completed</span>
      </div>
      {report.isError ? <ErrorState message={report.error.message} onRetry={() => report.refetch()} />
        : !data ? <TableSkeleton columns={4} />
        : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Sales" icon={Coins} tone="sales" value={rupees(data.revenue)} muted={!n(data.revenue)} hint={plural(data.orders, "order")} />
              <StatCard label="Weight sold" icon={Scale} tone="info" value={kg(data.kg)} muted={!n(data.kg)}
                hint={data.average_price ? `Rs. ${amount(data.average_price)} per kg on average` : undefined} />
              <StatCard label="Quotations won" icon={FileCheck2} tone="success" muted={data.quotation_win_pct == null}
                value={data.quotation_win_pct == null ? "—" : percent(data.quotation_win_pct)} hint={`${plural(data.quotations, "quotation")} in the period`} />
              <StatCard label="Returned" icon={Undo2} tone={n(data.returned_kg) ? "warning" : "success"} value={kg(data.returned_kg)} muted={!n(data.returned_kg)}
                hint={n(data.returned_credit) ? `${rupees(data.returned_credit)} credited` : "No approved returns"} />
            </div>
            <ChartCard title="Sales by month" description="Order value by the month the order was made">
              {months.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs><ChartGradient id="perf-revenue" color="var(--stage-sales)" /></defs>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="month" {...axisProps} />
                    <YAxis {...yAxisProps} />
                    <Tooltip cursor={cursorProps} content={<ChartTooltip format={(v) => rupees(v)} />} />
                    <Bar dataKey="revenue" name="Sales" fill="url(#perf-revenue)" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="py-10 text-center text-sm text-muted-foreground">No sales in this period.</p>}
            </ChartCard>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><ShoppingCart className="size-4" aria-hidden /> By customer</h3>
                <DataTable columns={columns} data={data.by_customer} searchPlaceholder="Search customers…" emptyTitle="No sales in this period"
                  initialSorting={[{ id: "revenue", desc: true }]} exportName="sales-by-customer" />
              </div>
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><Scale className="size-4" aria-hidden /> By material</h3>
                <DataTable columns={columns} data={data.by_product} searchPlaceholder="Search materials…" emptyTitle="No sales in this period"
                  initialSorting={[{ id: "revenue", desc: true }]} exportName="sales-by-material" />
              </div>
            </div>
          </>
        )}
    </div>
  )
}

// ─── Printing: invoice and delivery challan ─────────────────────────────────

const esc = (v: string | number | null | undefined) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

const PRINT_CSS = `
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:40px;font-size:14px}
  h1{font-size:22px;margin:0} .muted{color:#666} .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
  .right{text-align:right} table{width:100%;border-collapse:collapse;margin-top:20px} th,td{padding:8px 10px;border-bottom:1px solid #ddd;text-align:left}
  th{font-size:12px;text-transform:uppercase;color:#666} td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
  .totals{margin-top:16px;margin-left:auto;width:280px} .totals div{display:flex;justify-content:space-between;padding:4px 0}
  .totals .grand{border-top:2px solid #111;font-weight:700;margin-top:6px;padding-top:8px} .sign{margin-top:70px;display:flex;justify-content:space-between}
  .sign span{border-top:1px solid #111;padding-top:6px;width:200px;text-align:center}`

/** Opens a print window with the document. Returns false when the browser blocked it. */
function printDocument(title: string, body: string): boolean {
  const w = window.open("", "_blank", "width=860,height=980")
  if (!w) return false
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`)
  w.document.close()
  w.focus()
  w.print()
  return true
}

const header = (kind: string, number: string, lines: string[]) => `
  <div class="top"><div><h1>Textile Recycling ERP</h1><div class="muted">${esc(kind)}</div></div>
  <div class="right"><h1>${esc(number)}</h1>${lines.map((l) => `<div class="muted">${esc(l)}</div>`).join("")}</div></div>`

export function printInvoice(i: SalesInvoice): boolean {
  return printDocument(`Invoice ${i.number}`, `
    ${header("Sales invoice", i.number, [`Date: ${date(i.invoice_date)}`, `Due: ${date(i.due_date)}`, `Order #${i.order}`])}
    <div><div class="muted">Bill to</div><strong>${esc(i.customer_name)}</strong><div>${esc(i.customer_contact)}</div><div>${esc(i.customer_address)}</div></div>
    <table><thead><tr><th>Description</th><th class="n">Weight</th><th class="n">Price per kg</th><th class="n">Amount</th></tr></thead>
    <tbody><tr><td>${esc(i.fabric_material)} · ${esc(i.fabric_quality)}</td><td class="n">${esc(kg(i.weight))}</td>
    <td class="n">${esc(rupees(i.price_per_kg))}</td><td class="n">${esc(rupees(i.subtotal))}</td></tr></tbody></table>
    <div class="totals"><div><span>Subtotal</span><span>${esc(rupees(i.subtotal))}</span></div>
    ${n(i.discount_amount) ? `<div><span>Discount (${esc(n(i.discount_pct))}%)</span><span>− ${esc(rupees(i.discount_amount))}</span></div>` : ""}
    ${n(i.tax_amount) ? `<div><span>Tax (${esc(n(i.tax_pct))}%)</span><span>${esc(rupees(i.tax_amount))}</span></div>` : ""}
    <div class="grand"><span>Total</span><span>${esc(rupees(i.total))}</span></div>
    <div><span>Paid</span><span>${esc(rupees(i.paid))}</span></div>
    <div><span>Balance due</span><span>${esc(rupees(n(i.total) - n(i.paid)))}</span></div></div>
    ${i.notes ? `<p class="muted">${esc(i.notes)}</p>` : ""}
    <div class="sign"><span>Prepared by</span><span>Received by</span></div>`)
}

export function printChallan(d: Dispatch, order?: SalesOrder): boolean {
  return printDocument(`Delivery challan ${d.challan_number}`, `
    ${header("Delivery challan", d.challan_number, [`Date: ${date(d.dispatch_date)}`, `Order #${d.sales_order}`])}
    <div><div class="muted">Deliver to</div><strong>${esc(d.order_buyer)}</strong><div>${esc(order?.buyer_contact)}</div><div>${esc(order?.buyer_address)}</div></div>
    <table><thead><tr><th>Description</th><th>Vehicle</th><th>Driver</th><th class="n">Weight</th></tr></thead>
    <tbody><tr><td>${esc(order ? `${order.fabric_material} · ${order.fabric_quality}` : "Recycled fabric")}</td><td>${esc(d.vehicle_number)}</td>
    <td>${esc(d.driver_name)} ${esc(d.driver_contact)}</td><td class="n">${esc(kg(d.dispatched_weight))}</td></tr></tbody></table>
    ${d.notes ? `<p class="muted">${esc(d.notes)}</p>` : ""}
    <div class="sign"><span>Dispatched by (${esc(d.dispatched_by_name)})</span><span>Received by</span></div>`)
}
