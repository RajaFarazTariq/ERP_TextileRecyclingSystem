import { z } from "zod"

import { decimalString, requiredId } from "@/lib/forms"

export const REQUISITION_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Ordered", "Cancelled"] as const
export const ORDER_STATUSES = ["Draft", "Submitted", "Approved", "Partially Received", "Received", "Closed", "Cancelled"] as const
export const INVOICE_STATUSES = ["Unpaid", "Partial", "Paid"] as const
export const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Online Transfer"] as const
export const SUPPLIER_CATEGORIES = ["Textile waste", "Post-consumer", "Pre-consumer", "Chemicals", "Packaging", "Other"] as const

const optionalDate = z.string()

export const requisitionSchema = z.object({
  unit: z.string(),
  needed_by: optionalDate,
  notes: z.string().trim(),
  lines: z.array(z.object({
    material: z.string().trim().min(1, "Enter the material.").max(255),
    quantity_kg: decimalString("the quantity"),
    notes: z.string().trim().max(255),
  })).min(1, "Add at least one material."),
})
export type RequisitionForm = z.infer<typeof requisitionSchema>

export const orderSchema = z.object({
  vendor: requiredId("a supplier"),
  requisition: z.string(),
  order_date: z.string().min(1, "Enter the order date."),
  expected_date: optionalDate,
  notes: z.string().trim(),
  lines: z.array(z.object({
    id: z.number().optional(),
    material: z.string().trim().min(1, "Enter the material.").max(255),
    quantity_kg: decimalString("the quantity"),
    unit_price: decimalString("the price", { allowZero: true }),
  })).min(1, "Add at least one line."),
}).refine((v) => !v.expected_date || v.expected_date >= v.order_date, {
  path: ["expected_date"], message: "Expected date can't be before the order date.",
})
export type OrderForm = z.infer<typeof orderSchema>

export const invoiceSchema = z.object({
  vendor: requiredId("a supplier"),
  purchase_order: z.string(),
  invoice_number: z.string().trim().min(1, "Enter the supplier's invoice number.").max(100),
  invoice_date: z.string().min(1, "Enter the invoice date."),
  due_date: optionalDate,
  amount: decimalString("the amount"),
  tax_amount: decimalString("the tax", { allowZero: true }),
  notes: z.string().trim(),
}).refine((v) => !v.due_date || v.due_date >= v.invoice_date, {
  path: ["due_date"], message: "Due date can't be before the invoice date.",
})
export type InvoiceForm = z.infer<typeof invoiceSchema>

export const paymentSchema = z.object({
  invoice: requiredId("an invoice"),
  amount: decimalString("the amount"),
  method: z.enum(PAYMENT_METHODS),
  payment_date: z.string().min(1, "Enter the payment date."),
  reference: z.string().trim().max(100),
})
export type PaymentForm = z.infer<typeof paymentSchema>

export const returnSchema = z.object({
  receipt: requiredId("the delivery"),
  quantity_kg: decimalString("the quantity"),
  reason: z.string().trim().min(1, "Say why the material is returned."),
  return_date: z.string().min(1, "Enter the return date."),
})
export type ReturnForm = z.infer<typeof returnSchema>

export const quotationSchema = z.object({
  vendor: requiredId("a supplier"),
  material: z.string().trim().min(1, "Enter the material.").max(255),
  price_per_kg: decimalString("the price"),
  min_quantity_kg: z.string().trim().refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), "Enter a number."),
  quoted_on: z.string().min(1, "Enter the quote date."),
  valid_until: optionalDate,
  notes: z.string().trim().max(255),
}).refine((v) => !v.valid_until || v.valid_until >= v.quoted_on, {
  path: ["valid_until"], message: "Can't be before the quote date.",
})
export type QuotationForm = z.infer<typeof quotationSchema>

export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
