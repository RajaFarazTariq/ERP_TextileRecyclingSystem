"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Controller, type FieldErrors, useFieldArray, useForm, useWatch } from "react-hook-form"

import { Field, FieldGroup, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAction, useSave } from "@/lib/crud"
import { date, kg, rupees } from "@/lib/format"
import { applyServerErrors } from "@/lib/forms"
import type {
  FactoryUnit, PurchaseOrder, PurchaseReturn, Requisition, StockEntry, SupplierInvoice, SupplierPayment,
  SupplierQuotation, Vendor,
} from "@/types/api"
import {
  type InvoiceForm, type OrderForm, PAYMENT_METHODS, type PaymentForm, type QuotationForm, type RequisitionForm,
  type ReturnForm, invoiceSchema, orderSchema, paymentSchema, quotationSchema, requisitionSchema, returnSchema, today,
} from "./schemas"

export const PROCUREMENT_LISTS = [
  ["procurement/requisitions"], ["procurement/orders"], ["procurement/open-lines"], ["procurement/invoices"],
  ["procurement/payments"], ["procurement/returns"], ["procurement/quotations"], ["procurement/summary"],
  ["procurement/supplier-performance"], ["procurement/price-comparison"], ["warehouse/stock"],
]

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

const n = (v: string | number | null | undefined) => Number(v) || 0
const orNull = (v: string) => (v ? v : null)
const vendorOptions = (vendors: Vendor[], keep?: number) =>
  vendors.filter((v) => v.is_active !== false || v.id === keep).map((v) => ({ value: String(v.id), label: v.name }))

/** First error message under a line row, if any. */
function lineError(errors: FieldErrors, index: number): string | undefined {
  const row = (errors.lines as unknown as Record<number, Record<string, { message?: string }>> | undefined)?.[index]
  return row ? Object.values(row).find((e) => e?.message)?.message : undefined
}

// ─── Purchase request ───────────────────────────────────────────────────────

type RequisitionDialogProps = DialogProps<Requisition> & { units: FactoryUnit[] }

export function RequisitionDialog(props: RequisitionDialogProps) {
  return props.open ? <RequisitionDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function RequisitionDialogBody({ open, onOpenChange, record, units }: RequisitionDialogProps) {
  const save = useSave<Requisition>("procurement/requisitions", { noun: "Purchase request", invalidate: PROCUREMENT_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<RequisitionForm>({
    resolver: zodResolver(requisitionSchema),
    defaultValues: {
      unit: record?.unit ? String(record.unit) : "",
      needed_by: record?.needed_by ?? "",
      notes: record?.notes ?? "",
      lines: record?.lines.map((l) => ({ material: l.material, quantity_kg: l.quantity_kg, notes: l.notes }))
        ?? [{ material: "", quantity_kg: "", notes: "" }],
    },
  })
  const lines = useFieldArray({ control: form.control, name: "lines" })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: { ...values, unit: values.unit ? Number(values.unit) : null, needed_by: orNull(values.needed_by) },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.number}` : "New purchase request"}
      description="Ask for material to be bought. An admin approves it before an order is placed."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="req-unit" label="For unit">
          <Controller control={form.control} name="unit" render={({ field }) => (
            <SelectField id="req-unit" value={field.value} onChange={field.onChange} placeholder="Any unit" allowNone="Any unit"
              options={units.map((u) => ({ value: String(u.id), label: u.name }))} />
          )} />
        </Field>
        <Field id="needed_by" label="Needed by" error={errors.needed_by?.message}>
          <Input id="needed_by" type="date" {...form.register("needed_by")} />
        </Field>
      </div>
      <FieldGroup title="Materials">
        {lines.fields.map((line, i) => (
          <div key={line.id} className="space-y-1">
            <div className="grid grid-cols-[1fr_8rem_auto] items-start gap-2">
              <Input aria-label={`Material ${i + 1}`} placeholder="e.g. Cotton White" aria-invalid={!!errors.lines?.[i]?.material}
                {...form.register(`lines.${i}.material`)} />
              <Input aria-label={`Quantity ${i + 1} (kg)`} placeholder="kg" inputMode="decimal" aria-invalid={!!errors.lines?.[i]?.quantity_kg}
                {...form.register(`lines.${i}.quantity_kg`)} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove row ${i + 1}`}
                disabled={lines.fields.length === 1} onClick={() => lines.remove(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            {lineError(errors, i) && <p className="text-[13px] text-destructive">{lineError(errors, i)}</p>}
          </div>
        ))}
        <Button type="button" variant="outline" className="w-fit" onClick={() => lines.append({ material: "", quantity_kg: "", notes: "" })}>
          <Plus className="size-4" /> Add material
        </Button>
        {errors.lines?.root?.message && <p className="text-[13px] text-destructive">{errors.lines.root.message}</p>}
      </FieldGroup>
      <Field id="req-notes" label="Notes">
        <Textarea id="req-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Purchase order ─────────────────────────────────────────────────────────

type OrderDialogProps = DialogProps<PurchaseOrder> & {
  vendors: Vendor[]
  requisitions: Requisition[]
  /** Start a new order from this approved request */
  fromRequisition?: Requisition | null
}

export function OrderDialog(props: OrderDialogProps) {
  return props.open ? <OrderDialogBody key={props.record?.id ?? `new-${props.fromRequisition?.id ?? ""}`} {...props} /> : null
}

function OrderDialogBody({ open, onOpenChange, record, vendors, requisitions, fromRequisition }: OrderDialogProps) {
  const save = useSave<PurchaseOrder>("procurement/orders", { noun: "Purchase order", invalidate: PROCUREMENT_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      vendor: record ? String(record.vendor) : "",
      requisition: record?.requisition ? String(record.requisition) : fromRequisition ? String(fromRequisition.id) : "",
      order_date: record?.order_date ?? today(),
      expected_date: record?.expected_date ?? "",
      notes: record?.notes ?? "",
      lines: record?.lines.map((l) => ({ id: l.id, material: l.material, quantity_kg: l.quantity_kg, unit_price: l.unit_price }))
        ?? fromRequisition?.lines.map((l) => ({ material: l.material, quantity_kg: l.quantity_kg, unit_price: "" }))
        ?? [{ material: "", quantity_kg: "", unit_price: "" }],
    },
  })
  const lines = useFieldArray({ control: form.control, name: "lines", keyName: "key" })
  const { errors, isSubmitting } = form.formState
  const watched = useWatch({ control: form.control, name: "lines" })
  const total = (watched ?? []).reduce((a, l) => a + n(l?.quantity_kg) * n(l?.unit_price), 0)
  const approvedRequests = requisitions.filter((r) => r.status === "Approved" || r.id === record?.requisition || r.id === fromRequisition?.id)
  const amending = record && (record.status === "Approved" || record.status === "Partially Received")

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          vendor: Number(values.vendor),
          requisition: values.requisition ? Number(values.requisition) : null,
          expected_date: orNull(values.expected_date),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.number}` : "New purchase order"}
      description={amending
        ? "This order is approved: saving a change makes it an amendment that needs approval again."
        : "Save as a draft, then submit it for an admin to approve."}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="po-vendor" label="Supplier" error={errors.vendor?.message}>
          <Controller control={form.control} name="vendor" render={({ field }) => (
            <SelectField id="po-vendor" value={field.value} onChange={field.onChange} invalid={!!errors.vendor}
              placeholder="Select supplier" options={vendorOptions(vendors, record?.vendor)} />
          )} />
        </Field>
        <Field id="po-requisition" label="From request" hint="Optional: an approved purchase request">
          <Controller control={form.control} name="requisition" render={({ field }) => (
            <SelectField id="po-requisition" value={field.value} onChange={field.onChange} placeholder="None" allowNone="None"
              options={approvedRequests.map((r) => ({ value: String(r.id), label: `${r.number} · ${kg(r.total_kg)}` }))} />
          )} />
        </Field>
        <Field id="order_date" label="Order date" error={errors.order_date?.message}>
          <Input id="order_date" type="date" {...form.register("order_date")} />
        </Field>
        <Field id="expected_date" label="Expected delivery" error={errors.expected_date?.message}>
          <Input id="expected_date" type="date" {...form.register("expected_date")} />
        </Field>
      </div>
      <FieldGroup title="Lines">
        <div className="hidden grid-cols-[1fr_7rem_7rem_auto] gap-2 px-0.5 text-xs text-muted-foreground sm:grid">
          <span>Material</span><span>Quantity (kg)</span><span>Price per kg</span><span className="w-9" />
        </div>
        {lines.fields.map((line, i) => {
          const original = record?.lines.find((l) => l.id === line.id)
          return (
            <div key={line.key} className="space-y-1">
              <div className="grid grid-cols-[1fr_7rem_7rem_auto] items-start gap-2">
                <Input aria-label={`Material ${i + 1}`} placeholder="e.g. Cotton White" aria-invalid={!!errors.lines?.[i]?.material}
                  {...form.register(`lines.${i}.material`)} />
                <Input aria-label={`Quantity ${i + 1} (kg)`} placeholder="kg" inputMode="decimal" aria-invalid={!!errors.lines?.[i]?.quantity_kg}
                  {...form.register(`lines.${i}.quantity_kg`)} />
                <Input aria-label={`Price per kg ${i + 1} (Rs.)`} placeholder="Rs." inputMode="decimal" aria-invalid={!!errors.lines?.[i]?.unit_price}
                  {...form.register(`lines.${i}.unit_price`)} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove line ${i + 1}`}
                  disabled={lines.fields.length === 1 || n(original?.received_kg) > 0} onClick={() => lines.remove(i)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {original && n(original.received_kg) > 0 && (
                <p className="text-xs text-muted-foreground">{kg(original.received_kg)} received so far</p>
              )}
              {lineError(errors, i) && <p className="text-[13px] text-destructive">{lineError(errors, i)}</p>}
            </div>
          )
        })}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => lines.append({ material: "", quantity_kg: "", unit_price: "" })}>
            <Plus className="size-4" /> Add line
          </Button>
          <p className="text-sm">Total: <span className="font-semibold">{rupees(total)}</span></p>
        </div>
        {errors.lines?.root?.message && <p className="text-[13px] text-destructive">{errors.lines.root.message}</p>}
      </FieldGroup>
      <Field id="po-notes" label="Notes">
        <Textarea id="po-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Reject a request ───────────────────────────────────────────────────────

export function RejectDialog({ requisition, onOpenChange }: { requisition: Requisition | null; onOpenChange: (o: boolean) => void }) {
  return requisition ? <RejectDialogBody key={requisition.id} requisition={requisition} onOpenChange={onOpenChange} /> : null
}

function RejectDialogBody({ requisition, onOpenChange }: { requisition: Requisition; onOpenChange: (o: boolean) => void }) {
  const reject = useAction<{ reason: string }>("procurement/requisitions", "reject", { success: "Request rejected.", invalidate: PROCUREMENT_LISTS })
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  return (
    <FormDialog open onOpenChange={onOpenChange} title={`Reject ${requisition.number}?`}
      description="The requester sees the reason and can change the request and submit it again."
      error={error} submitting={reject.isPending} submitLabel="Reject"
      onSubmit={async (e) => {
        e.preventDefault()
        setError("")
        if (!reason.trim()) return setError("Say why the request is rejected.")
        try {
          await reject.mutateAsync({ id: requisition.id, body: { reason } })
          onOpenChange(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not reject the request.")
        }
      }}>
      <Field id="reject-reason" label="Reason">
        <Textarea id="reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </FormDialog>
  )
}

// ─── Supplier invoice ───────────────────────────────────────────────────────

type InvoiceDialogProps = DialogProps<SupplierInvoice> & { vendors: Vendor[]; orders: PurchaseOrder[]; fromOrder?: PurchaseOrder | null }

export function InvoiceDialog(props: InvoiceDialogProps) {
  return props.open ? <InvoiceDialogBody key={props.record?.id ?? `new-${props.fromOrder?.id ?? ""}`} {...props} /> : null
}

function InvoiceDialogBody({ open, onOpenChange, record, vendors, orders, fromOrder }: InvoiceDialogProps) {
  const save = useSave<SupplierInvoice>("procurement/invoices", { noun: "Invoice", invalidate: PROCUREMENT_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      vendor: record ? String(record.vendor) : fromOrder ? String(fromOrder.vendor) : "",
      purchase_order: record?.purchase_order ? String(record.purchase_order) : fromOrder ? String(fromOrder.id) : "",
      invoice_number: record?.invoice_number ?? "",
      invoice_date: record?.invoice_date ?? today(),
      due_date: record?.due_date ?? "",
      amount: record?.amount ?? (fromOrder ? String(Math.max(n(fromOrder.total_amount) - n(fromOrder.invoiced_amount), 0)) : ""),
      tax_amount: record?.tax_amount ?? "0",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const [vendorId, amount, tax] = useWatch({ control: form.control, name: ["vendor", "amount", "tax_amount"] })
  const vendorOrders = orders.filter((o) => String(o.vendor) === vendorId && o.status !== "Draft" && o.status !== "Cancelled")

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          vendor: Number(values.vendor),
          purchase_order: values.purchase_order ? Number(values.purchase_order) : null,
          due_date: orNull(values.due_date),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit invoice ${record.invoice_number}` : "Record supplier invoice"}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="inv-vendor" label="Supplier" error={errors.vendor?.message}>
        <Controller control={form.control} name="vendor" render={({ field }) => (
          <SelectField id="inv-vendor" value={field.value} invalid={!!errors.vendor} placeholder="Select supplier"
            onChange={(v) => { field.onChange(v); form.setValue("purchase_order", "") }}
            options={vendorOptions(vendors, record?.vendor)} />
        )} />
      </Field>
      <Field id="inv-order" label="Purchase order" error={errors.purchase_order?.message} hint="Optional">
        <Controller control={form.control} name="purchase_order" render={({ field }) => (
          <SelectField id="inv-order" value={field.value} onChange={field.onChange} placeholder="None" allowNone="None"
            options={vendorOrders.map((o) => ({ value: String(o.id), label: `${o.number} · ${rupees(o.total_amount)}` }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="invoice_number" label="Invoice no." error={errors.invoice_number?.message}>
          <Input id="invoice_number" aria-invalid={!!errors.invoice_number} {...form.register("invoice_number")} />
        </Field>
        <Field id="invoice_date" label="Invoice date" error={errors.invoice_date?.message}>
          <Input id="invoice_date" type="date" {...form.register("invoice_date")} />
        </Field>
        <Field id="due_date" label="Due date" error={errors.due_date?.message}>
          <Input id="due_date" type="date" {...form.register("due_date")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="inv-amount" label="Amount before tax (Rs.)" error={errors.amount?.message}>
          <Input id="inv-amount" inputMode="decimal" aria-invalid={!!errors.amount} {...form.register("amount")} />
        </Field>
        <Field id="tax_amount" label="Tax (Rs.)" error={errors.tax_amount?.message}>
          <Input id="tax_amount" inputMode="decimal" aria-invalid={!!errors.tax_amount} {...form.register("tax_amount")} />
        </Field>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm">Invoice total: <span className="font-semibold">{rupees(n(amount) + n(tax))}</span></p>
      <Field id="inv-notes" label="Notes">
        <Textarea id="inv-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Supplier payment ───────────────────────────────────────────────────────

type PaymentDialogProps = DialogProps<SupplierPayment> & { invoices: SupplierInvoice[]; forInvoice?: SupplierInvoice | null }

export function PaymentDialog(props: PaymentDialogProps) {
  return props.open ? <PaymentDialogBody key={props.record?.id ?? `new-${props.forInvoice?.id ?? ""}`} {...props} /> : null
}

function PaymentDialogBody({ open, onOpenChange, record, invoices, forInvoice }: PaymentDialogProps) {
  const save = useSave<SupplierPayment>("procurement/payments", { noun: "Payment", invalidate: PROCUREMENT_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      invoice: record ? String(record.invoice) : forInvoice ? String(forInvoice.id) : "",
      amount: record?.amount ?? (forInvoice ? forInvoice.outstanding : ""),
      method: record?.method ?? "Bank Transfer",
      payment_date: record?.payment_date ?? today(),
      reference: record?.reference ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const invoiceId = useWatch({ control: form.control, name: "invoice" })
  const invoice = invoices.find((i) => String(i.id) === invoiceId)
  const payable = invoices.filter((i) => i.status !== "Paid" || i.id === record?.invoice)

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, invoice: Number(values.invoice) } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit payment" : "Record supplier payment"}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="pay-invoice" label="Invoice" error={errors.invoice?.message}
        hint={invoice ? `${rupees(invoice.outstanding)} outstanding of ${rupees(invoice.total)}` : undefined}>
        <Controller control={form.control} name="invoice" render={({ field }) => (
          <SelectField id="pay-invoice" value={field.value} onChange={field.onChange} invalid={!!errors.invoice} placeholder="Select invoice"
            options={payable.map((i) => ({ value: String(i.id), label: `${i.vendor_name} · ${i.invoice_number} · ${rupees(i.outstanding)} due` }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pay-amount" label="Amount (Rs.)" error={errors.amount?.message}>
          <Input id="pay-amount" inputMode="decimal" aria-invalid={!!errors.amount} {...form.register("amount")} />
        </Field>
        <Field id="payment_date" label="Payment date" error={errors.payment_date?.message}>
          <Input id="payment_date" type="date" {...form.register("payment_date")} />
        </Field>
        <Field id="pay-method" label="Method">
          <Controller control={form.control} name="method" render={({ field }) => (
            <SelectField id="pay-method" value={field.value} onChange={field.onChange} placeholder="Method"
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
          )} />
        </Field>
        <Field id="pay-reference" label="Reference" hint="Cheque or transfer number">
          <Input id="pay-reference" {...form.register("reference")} />
        </Field>
      </div>
    </FormDialog>
  )
}

// ─── Purchase return ────────────────────────────────────────────────────────

type ReturnDialogProps = DialogProps<PurchaseReturn> & { deliveries: StockEntry[] }

export function ReturnDialog(props: ReturnDialogProps) {
  return props.open ? <ReturnDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function ReturnDialogBody({ open, onOpenChange, record, deliveries }: ReturnDialogProps) {
  const save = useSave<PurchaseReturn>("procurement/returns", { noun: "Return", invalidate: PROCUREMENT_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<ReturnForm>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      receipt: record ? String(record.receipt) : "",
      quantity_kg: record?.quantity_kg ?? "",
      reason: record?.reason ?? "",
      return_date: record?.return_date ?? today(),
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, receipt: Number(values.receipt) } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.number}` : "Return to supplier"}
      description="Records material sent back from a delivery. The delivery itself isn't changed."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="ret-receipt" label="Delivery" error={errors.receipt?.message}>
        <Controller control={form.control} name="receipt" render={({ field }) => (
          <SelectField id="ret-receipt" value={field.value} onChange={field.onChange} invalid={!!errors.receipt} placeholder="Select delivery"
            options={deliveries.slice(0, 200).map((d) => ({
              value: String(d.id),
              label: `${d.vendor_name} · ${d.fabric_type} · ${kg(d.our_weight)} · ${date(d.created_at)}`,
            }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ret-qty" label="Quantity (kg)" error={errors.quantity_kg?.message}>
          <Input id="ret-qty" inputMode="decimal" aria-invalid={!!errors.quantity_kg} {...form.register("quantity_kg")} />
        </Field>
        <Field id="return_date" label="Return date" error={errors.return_date?.message}>
          <Input id="return_date" type="date" {...form.register("return_date")} />
        </Field>
      </div>
      <Field id="ret-reason" label="Reason" error={errors.reason?.message}>
        <Textarea id="ret-reason" rows={3} aria-invalid={!!errors.reason} {...form.register("reason")} />
      </Field>
    </FormDialog>
  )
}

// ─── Supplier quotation ─────────────────────────────────────────────────────

type QuotationDialogProps = DialogProps<SupplierQuotation> & { vendors: Vendor[] }

export function QuotationDialog(props: QuotationDialogProps) {
  return props.open ? <QuotationDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function QuotationDialogBody({ open, onOpenChange, record, vendors }: QuotationDialogProps) {
  const save = useSave<SupplierQuotation>("procurement/quotations", { noun: "Quote", invalidate: PROCUREMENT_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<QuotationForm>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      vendor: record ? String(record.vendor) : "",
      material: record?.material ?? "",
      price_per_kg: record?.price_per_kg ?? "",
      min_quantity_kg: record?.min_quantity_kg ?? "",
      quoted_on: record?.quoted_on ?? today(),
      valid_until: record?.valid_until ?? "",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values, vendor: Number(values.vendor),
          min_quantity_kg: orNull(values.min_quantity_kg), valid_until: orNull(values.valid_until),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit quote" : "Add supplier quote"}
      description="Prices suppliers offer, for comparing before ordering."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="q-vendor" label="Supplier" error={errors.vendor?.message}>
        <Controller control={form.control} name="vendor" render={({ field }) => (
          <SelectField id="q-vendor" value={field.value} onChange={field.onChange} invalid={!!errors.vendor}
            placeholder="Select supplier" options={vendorOptions(vendors, record?.vendor)} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="q-material" label="Material" error={errors.material?.message}>
          <Input id="q-material" aria-invalid={!!errors.material} {...form.register("material")} />
        </Field>
        <Field id="q-price" label="Price per kg (Rs.)" error={errors.price_per_kg?.message}>
          <Input id="q-price" inputMode="decimal" aria-invalid={!!errors.price_per_kg} {...form.register("price_per_kg")} />
        </Field>
        <Field id="q-min" label="Minimum quantity (kg)" error={errors.min_quantity_kg?.message}>
          <Input id="q-min" inputMode="decimal" {...form.register("min_quantity_kg")} />
        </Field>
        <Field id="quoted_on" label="Quote date" error={errors.quoted_on?.message}>
          <Input id="quoted_on" type="date" {...form.register("quoted_on")} />
        </Field>
        <Field id="valid_until" label="Valid until" error={errors.valid_until?.message}>
          <Input id="valid_until" type="date" {...form.register("valid_until")} />
        </Field>
      </div>
      <Field id="q-notes" label="Notes">
        <Input id="q-notes" {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}
