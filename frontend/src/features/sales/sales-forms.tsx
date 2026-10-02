"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { Field, FieldGroup, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ROLE_LABELS } from "@/config/access"
import { api } from "@/lib/api"
import { useSave } from "@/lib/crud"
import { kg, rupees } from "@/lib/format"
import { applyServerErrors } from "@/lib/forms"
import type { Customer, Dispatch, FabricLot, Payment, Product, SalesOrder, UserSummary } from "@/types/api"
import {
  CUSTOMER_CATEGORIES,
  type CustomerForm,
  DISPATCH_STATUSES,
  type DispatchForm,
  ORDER_STATUSES,
  type OrderForm,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PaymentForm,
  customerSchema,
  dispatchSchema,
  orderSchema,
  paymentSchema,
  previewTotal,
} from "./schemas"

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

export const SALES_LISTS = [["sales/orders"], ["sales/dispatch"], ["sales/payments"], ["sales/orders/summary"], ["sales/customers"],
  ["sales/quotations"], ["sales/invoices"], ["sales/returns"], ["sales/performance"],
  ["sorting/fabric-stock"], ["inventory/movements/stock"]]

/** A product's price for a customer: the price for their category, else the list price. */
export function priceFor(product: Product, customer?: Customer): string {
  return product.prices.find((p) => p.customer_category === customer?.category)?.price_per_kg ?? product.price_per_kg
}

const userOptions = (users: UserSummary[]) =>
  users.filter((u) => u.is_active).map((u) => ({ value: String(u.id), label: `${u.username} (${ROLE_LABELS[u.role]})` }))

const orderLabel = (o: SalesOrder) => `#${o.id} — ${o.buyer_name} (${kg(o.weight_sold)})`

// ─── Order ──────────────────────────────────────────────────────────────────

type OrderDialogProps = DialogProps<SalesOrder> & { fabrics: FabricLot[]; customers: Customer[]; products: Product[] }

export function OrderDialog(props: OrderDialogProps) {
  return props.open ? <OrderDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function OrderDialogBody({ open, onOpenChange, record, fabrics, customers, products }: OrderDialogProps) {
  const save = useSave<SalesOrder>("sales/orders", { noun: "Order", invalidate: SALES_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      buyer_name: record?.buyer_name ?? "",
      buyer_contact: record?.buyer_contact ?? "",
      fabric: record ? String(record.fabric) : "",
      fabric_quality: record?.fabric_quality ?? "",
      weight_sold: record?.weight_sold ?? "",
      price_per_kg: record?.price_per_kg ?? "",
      status: record?.status ?? "Draft",
      payment_status: record?.payment_status ?? "Pending",
      notes: record?.notes ?? "",
      product: record?.product ? String(record.product) : "",
      discount_pct: record && Number(record.discount_pct) ? record.discount_pct : "",
      tax_pct: record && Number(record.tax_pct) ? record.tax_pct : "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const [weight, price, fabricId, discount, tax, buyer] = useWatch({
    control: form.control, name: ["weight_sold", "price_per_kg", "fabric", "discount_pct", "tax_pct", "buyer_name"],
  })
  const total = previewTotal(weight, price, discount, tax)
  const fabric = fabrics.find((f) => String(f.id) === fabricId)
  const customer = customers.find((c) => c.name.toLowerCase() === buyer.trim().toLowerCase())

  /** Choosing a product fills in its grade and the price for this customer. */
  const applyProduct = (id: string) => {
    form.setValue("product", id)
    const product = products.find((p) => String(p.id) === id)
    if (!product) return
    if (product.grade) form.setValue("fabric_quality", product.grade, { shouldValidate: true })
    form.setValue("price_per_kg", priceFor(product, customer), { shouldValidate: true })
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values, fabric: Number(values.fabric), product: values.product ? Number(values.product) : null,
          discount_pct: values.discount_pct || "0", tax_pct: values.tax_pct || "0",
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit order #${record.id}` : "New order"}
      description="Draft orders don't hold stock. Confirming reserves the kg, and needs enough dried stock."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="buyer_name" label="Buyer" hint="Pick an existing customer or type a new name" error={errors.buyer_name?.message}>
          <Input id="buyer_name" list="customer-names" autoComplete="off" aria-invalid={!!errors.buyer_name} {...form.register("buyer_name")} />
          <datalist id="customer-names">
            {customers.map((c) => <option key={c.id} value={c.name} />)}
          </datalist>
        </Field>
        <Field id="buyer_contact" label="Buyer contact" error={errors.buyer_contact?.message}>
          <Input id="buyer_contact" {...form.register("buyer_contact")} />
        </Field>
      </div>
      {customer?.over_limit && (
        <p className="rounded-md border border-warning/30 bg-warning/8 px-3 py-2 text-sm">
          {customer.name} owes {rupees(customer.balance)}, over their credit limit of {rupees(customer.credit_limit)}. The order can still be saved.
        </p>
      )}
      {products.length > 0 && (
        <Field id="order-product" label="Product" hint="Optional: fills in the quality and the price for this customer">
          <Controller control={form.control} name="product" render={({ field }) => (
            <SelectField id="order-product" value={field.value} onChange={applyProduct} placeholder="None" allowNone="None"
              options={products.filter((p) => p.is_active || p.id === record?.product).map((p) => ({ value: String(p.id), label: p.name }))} />
          )} />
        </Field>
      )}
      <Field id="order-fabric" label="Fabric lot" error={errors.fabric?.message}
        hint={fabric ? `${kg(fabric.dried_available_kg)} of dried stock available` : undefined}>
        <Controller control={form.control} name="fabric" render={({ field }) => (
          <SelectField id="order-fabric" value={field.value} onChange={field.onChange} invalid={!!errors.fabric}
            placeholder="Select fabric lot"
            options={fabrics.map((f) => ({ value: String(f.id), label: `${f.material_type} — ${kg(f.dried_available_kg)} available` }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="fabric_quality" label="Quality" error={errors.fabric_quality?.message}>
          <Input id="fabric_quality" placeholder="e.g. Grade A" aria-invalid={!!errors.fabric_quality} {...form.register("fabric_quality")} />
        </Field>
        <Field id="weight_sold" label="Weight (kg)" error={errors.weight_sold?.message}>
          <Input id="weight_sold" inputMode="decimal" aria-invalid={!!errors.weight_sold} {...form.register("weight_sold")} />
        </Field>
        <Field id="price_per_kg" label="Price per kg (Rs.)" error={errors.price_per_kg?.message}>
          <Input id="price_per_kg" inputMode="decimal" aria-invalid={!!errors.price_per_kg} {...form.register("price_per_kg")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="discount_pct" label="Discount, %" hint="Optional" error={errors.discount_pct?.message}>
          <Input id="discount_pct" inputMode="decimal" aria-invalid={!!errors.discount_pct} {...form.register("discount_pct")} />
        </Field>
        <Field id="tax_pct" label="Tax, %" hint="Optional; charged after the discount" error={errors.tax_pct?.message}>
          <Input id="tax_pct" inputMode="decimal" aria-invalid={!!errors.tax_pct} {...form.register("tax_pct")} />
        </Field>
      </div>
      {Number.isFinite(total) && total > 0 && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">Total: <span className="font-semibold tabular-nums">{rupees(total)}</span></p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="order-status" label="Order status">
          <Controller control={form.control} name="status" render={({ field }) => (
            <SelectField id="order-status" value={field.value} onChange={field.onChange} placeholder="Status"
              options={ORDER_STATUSES.map((s) => ({ value: s, label: s }))} />
          )} />
        </Field>
        <Field id="payment_status" label="Payment status">
          <Controller control={form.control} name="payment_status" render={({ field }) => (
            <SelectField id="payment_status" value={field.value} onChange={field.onChange} placeholder="Status"
              options={PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))} />
          )} />
        </Field>
        <Field id="created_by" label="Created by">
          <Input id="created_by" disabled value={record ? record.created_by_name : "You"} />
        </Field>
      </div>
      <Field id="order-notes" label="Notes">
        <Textarea id="order-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

type DispatchDialogProps = DialogProps<Dispatch> & { orders: SalesOrder[]; users: UserSummary[]; orderId?: number }

export function DispatchDialog(props: DispatchDialogProps) {
  return props.open ? <DispatchDialogBody key={props.record?.id ?? `new-${props.orderId ?? ""}`} {...props} /> : null
}

function DispatchDialogBody({ open, onOpenChange, record, orders, users, orderId }: DispatchDialogProps) {
  const save = useSave<Dispatch>("sales/dispatch", { noun: "Dispatch", invalidate: SALES_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<DispatchForm>({
    resolver: zodResolver(dispatchSchema),
    defaultValues: {
      sales_order: record ? String(record.sales_order) : orderId ? String(orderId) : "",
      vehicle_number: record?.vehicle_number ?? "",
      driver_name: record?.driver_name ?? "",
      driver_contact: record?.driver_contact ?? "",
      dispatched_weight: record?.dispatched_weight ?? "",
      dispatch_status: record?.dispatch_status ?? "Pending",
      dispatched_by: record ? String(record.dispatched_by) : "",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState

  // Only confirmed orders can be dispatched; keep this dispatch's own order listed when editing
  const eligible = orders.filter((o) => ["Confirmed", "Dispatched"].includes(o.status) || o.id === record?.sales_order)
  const orderId_ = useWatch({ control: form.control, name: "sales_order" })
  const order = orders.find((o) => String(o.id) === orderId_)
  const shipped = order ? order.dispatches.filter((d) => d.id !== record?.id).reduce((a, d) => a + Number(d.dispatched_weight), 0) : 0

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          sales_order: Number(values.sales_order),
          ...(values.dispatched_by ? { dispatched_by: Number(values.dispatched_by) } : { dispatched_by: undefined }),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit dispatch" : "Dispatch order"}
      description="Dispatching takes the weight out of stock. An order can go out in several dispatches."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="sales_order" label="Order" error={errors.sales_order?.message}
        hint={order ? `${kg(Number(order.weight_sold) - shipped)} of ${kg(order.weight_sold)} left to dispatch` : "Only confirmed orders can be dispatched"}>
        <Controller control={form.control} name="sales_order" render={({ field }) => (
          <SelectField id="sales_order" value={field.value} onChange={field.onChange} invalid={!!errors.sales_order}
            placeholder={eligible.length ? "Select order" : "No confirmed orders"}
            options={eligible.map((o) => ({ value: String(o.id), label: orderLabel(o) }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="vehicle_number" label="Vehicle number" error={errors.vehicle_number?.message}>
          <Input id="vehicle_number" aria-invalid={!!errors.vehicle_number} {...form.register("vehicle_number")} />
        </Field>
        <Field id="dispatched_weight" label="Weight (kg)" error={errors.dispatched_weight?.message}>
          <Input id="dispatched_weight" inputMode="decimal" aria-invalid={!!errors.dispatched_weight} {...form.register("dispatched_weight")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="driver_name" label="Driver name"><Input id="driver_name" {...form.register("driver_name")} /></Field>
        <Field id="driver_contact" label="Driver contact"><Input id="driver_contact" {...form.register("driver_contact")} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="dispatch_status" label="Status">
          <Controller control={form.control} name="dispatch_status" render={({ field }) => (
            <SelectField id="dispatch_status" value={field.value} onChange={field.onChange} placeholder="Status"
              options={DISPATCH_STATUSES.map((s) => ({ value: s, label: s }))} />
          )} />
        </Field>
        <Field id="dispatched_by" label="Dispatched by" hint="Leave empty to record yourself">
          <Controller control={form.control} name="dispatched_by" render={({ field }) => (
            <SelectField id="dispatched_by" value={field.value} onChange={field.onChange} placeholder="You" allowNone="You"
              options={userOptions(users)} />
          )} />
        </Field>
      </div>
      <Field id="dispatch-notes" label="Notes"><Textarea id="dispatch-notes" rows={2} {...form.register("notes")} /></Field>
    </FormDialog>
  )
}

// ─── Payment ────────────────────────────────────────────────────────────────

type PaymentDialogProps = DialogProps<Payment> & { orders: SalesOrder[]; users: UserSummary[] }

export function PaymentDialog(props: PaymentDialogProps) {
  return props.open ? <PaymentDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function PaymentDialogBody({ open, onOpenChange, record, orders, users }: PaymentDialogProps) {
  const save = useSave<Payment>("sales/payments", { noun: "Payment", invalidate: SALES_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      sales_order: record ? String(record.sales_order) : "",
      amount: record?.amount ?? "",
      payment_method: record?.payment_method ?? "Cash",
      reference_number: record?.reference_number ?? "",
      received_by: record ? String(record.received_by) : "",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const orderId = useWatch({ control: form.control, name: "sales_order" })
  const order = orders.find((o) => String(o.id) === orderId)
  const paid = order ? order.payments.filter((p) => p.id !== record?.id).reduce((a, p) => a + Number(p.amount), 0) : 0

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          sales_order: Number(values.sales_order),
          ...(values.received_by ? { received_by: Number(values.received_by) } : { received_by: undefined }),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit payment" : "Record payment"}
      description="The order's payment status updates automatically."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="payment-order" label="Order" error={errors.sales_order?.message}
        hint={order ? `${rupees(paid)} of ${rupees(order.total_price)} received so far` : undefined}>
        <Controller control={form.control} name="sales_order" render={({ field }) => (
          <SelectField id="payment-order" value={field.value} onChange={field.onChange} invalid={!!errors.sales_order}
            placeholder="Select order"
            options={orders.filter((o) => o.status !== "Cancelled" || o.id === record?.sales_order)
              .map((o) => ({ value: String(o.id), label: `${orderLabel(o)} · ${o.payment_status}` }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="amount" label="Amount (Rs.)" error={errors.amount?.message}>
          <Input id="amount" inputMode="decimal" aria-invalid={!!errors.amount} {...form.register("amount")} />
        </Field>
        <Field id="payment_method" label="Method">
          <Controller control={form.control} name="payment_method" render={({ field }) => (
            <SelectField id="payment_method" value={field.value} onChange={field.onChange} placeholder="Method"
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
          )} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="reference_number" label="Reference number"><Input id="reference_number" placeholder="Cheque / transaction no." {...form.register("reference_number")} /></Field>
        <Field id="received_by" label="Received by" hint="Leave empty to record yourself">
          <Controller control={form.control} name="received_by" render={({ field }) => (
            <SelectField id="received_by" value={field.value} onChange={field.onChange} placeholder="You" allowNone="You"
              options={userOptions(users)} />
          )} />
        </Field>
      </div>
      <Field id="payment-notes" label="Notes"><Textarea id="payment-notes" rows={2} {...form.register("notes")} /></Field>
    </FormDialog>
  )
}

// ─── Customer ───────────────────────────────────────────────────────────────

export function CustomerDialog(props: DialogProps<Customer>) {
  return props.open ? <CustomerDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function CustomerDialogBody({ open, onOpenChange, record }: DialogProps<Customer>) {
  const save = useSave<Customer>("sales/customers", { noun: "Customer" })
  const [formError, setFormError] = useState("")
  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: record?.name ?? "", contact: record?.contact ?? "", address: record?.address ?? "", notes: record?.notes ?? "",
      email: record?.email ?? "", category: record?.category ?? "",
      credit_limit: record && Number(record.credit_limit) ? record.credit_limit : "",
      payment_terms_days: record?.payment_terms_days ? String(record.payment_terms_days) : "",
      is_active: record && !record.is_active ? "no" : "yes",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values, credit_limit: values.credit_limit || "0", payment_terms_days: Number(values.payment_terms_days) || 0,
          is_active: values.is_active === "yes",
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit customer" : "Add customer"}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="customer-name" label="Name" error={errors.name?.message}>
        <Input id="customer-name" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="customer-contact" label="Contact"><Input id="customer-contact" {...form.register("contact")} /></Field>
        <Field id="customer-email" label="Email" error={errors.email?.message}>
          <Input id="customer-email" type="email" aria-invalid={!!errors.email} {...form.register("email")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="customer-category" label="Category" hint="Decides which price list applies">
          <Controller control={form.control} name="category" render={({ field }) => (
            <SelectField id="customer-category" value={field.value} onChange={field.onChange} placeholder="None" allowNone="None"
              options={CUSTOMER_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          )} />
        </Field>
        <Field id="customer-active" label="Status">
          <Controller control={form.control} name="is_active" render={({ field }) => (
            <SelectField id="customer-active" value={field.value} onChange={field.onChange} placeholder="Select status"
              options={[{ value: "yes", label: "Active" }, { value: "no", label: "Not active" }]} />
          )} />
        </Field>
      </div>
      <FieldGroup title="Credit">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="credit_limit" label="Credit limit (Rs.)" hint="Empty = no limit. Going over it warns, it never blocks."
            error={errors.credit_limit?.message}>
            <Input id="credit_limit" inputMode="decimal" aria-invalid={!!errors.credit_limit} {...form.register("credit_limit")} />
          </Field>
          <Field id="payment_terms_days" label="Payment terms, days" hint="Sets the due date on invoices" error={errors.payment_terms_days?.message}>
            <Input id="payment_terms_days" inputMode="numeric" aria-invalid={!!errors.payment_terms_days} {...form.register("payment_terms_days")} />
          </Field>
        </div>
      </FieldGroup>
      <Field id="customer-address" label="Address"><Textarea id="customer-address" rows={2} {...form.register("address")} /></Field>
      <Field id="customer-notes" label="Notes"><Textarea id="customer-notes" rows={2} {...form.register("notes")} /></Field>
    </FormDialog>
  )
}

// ─── Merge customers (admin) ────────────────────────────────────────────────

export function MergeDialog({
  source, customers, onOpenChange, onMerged,
}: {
  source: Customer | null
  customers: Customer[]
  onOpenChange: (open: boolean) => void
  onMerged: () => void
}) {
  const [into, setInto] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  if (!source) return null

  return (
    <FormDialog open onOpenChange={onOpenChange} title={`Merge “${source.name}”`}
      description={`Its ${source.order_count} order(s) move to the customer you choose, and “${source.name}” is removed. Order buyer names stay as typed.`}
      error={error} submitting={busy} submitLabel="Merge"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!into) return setError("Choose the customer to merge into.")
        setBusy(true)
        setError("")
        try {
          await api(`sales/customers/${source.id}/merge`, { method: "POST", body: { into: Number(into) } })
          onMerged()
          onOpenChange(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not merge.")
        } finally {
          setBusy(false)
        }
      }}>
      <Field id="merge-into" label="Merge into">
        <SelectField id="merge-into" value={into} onChange={setInto} placeholder="Select customer"
          options={customers.filter((c) => c.id !== source.id).map((c) => ({ value: String(c.id), label: `${c.name} (${c.order_count} orders)` }))} />
      </Field>
    </FormDialog>
  )
}
