import { z } from "zod"

import { decimalString, requiredId } from "@/lib/forms"

export const ORDER_STATUSES = ["Draft", "Confirmed", "Dispatched", "Completed", "Cancelled"] as const
export const PAYMENT_STATUSES = ["Pending", "Partial", "Paid"] as const
export const DISPATCH_STATUSES = ["Pending", "Loading", "Dispatched", "Delivered"] as const
export const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Online Transfer"] as const

export const CUSTOMER_CATEGORIES = ["Wholesaler", "Manufacturer", "Exporter", "Retailer", "Other"] as const
export const QUOTATION_STATUSES = ["Draft", "Sent", "Accepted", "Rejected", "Converted"] as const
export const INVOICE_STATUSES = ["Unpaid", "Partial", "Paid", "Overdue"] as const
export const RETURN_STATUSES = ["Requested", "Approved", "Rejected"] as const
const YES_NO = ["yes", "no"] as const

/** An optional percentage typed into a text box: "" or 0 to 100 with up to 2 decimals. */
const percentString = z.string().trim().refine(
  (v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 100), "Enter a percentage from 0 to 100.")
const optionalAmount = (label: string) =>
  z.string().trim().refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), `${label} must be a number with up to 2 decimals.`)

/** Weight x price, less the discount, plus tax on the rest (the server computes the saved total the same way). */
export function previewTotal(weight: string, price: string, discount: string, tax: string): number {
  const gross = Number(weight) * Number(price)
  return gross * (1 - (Number(discount) || 0) / 100) * (1 + (Number(tax) || 0) / 100)
}

export const orderSchema = z.object({
  product: z.string(), // optional: "" = none
  discount_pct: percentString,
  tax_pct: percentString,
  buyer_name: z.string().trim().min(1, "Enter the buyer's name.").max(255),
  buyer_contact: z.string().trim().max(100),
  fabric: requiredId("a fabric lot"),
  fabric_quality: z.string().trim().min(1, "Enter the fabric quality.").max(100),
  weight_sold: decimalString("the weight sold"),
  price_per_kg: decimalString("the price per kg"),
  status: z.enum(ORDER_STATUSES),
  payment_status: z.enum(PAYMENT_STATUSES),
  notes: z.string().trim(),
})
export type OrderForm = z.infer<typeof orderSchema>

export const dispatchSchema = z.object({
  sales_order: requiredId("an order"),
  vehicle_number: z.string().trim().min(1, "Enter the vehicle number.").max(50),
  driver_name: z.string().trim().max(100),
  driver_contact: z.string().trim().max(50),
  dispatched_weight: decimalString("the dispatched weight"),
  dispatch_status: z.enum(DISPATCH_STATUSES),
  dispatched_by: z.string(), // optional: defaults to you
  notes: z.string().trim(),
})
export type DispatchForm = z.infer<typeof dispatchSchema>

export const paymentSchema = z.object({
  sales_order: requiredId("an order"),
  amount: decimalString("the amount"),
  payment_method: z.enum(PAYMENT_METHODS),
  reference_number: z.string().trim().max(100),
  received_by: z.string(), // optional: defaults to you
  notes: z.string().trim(),
})
export type PaymentForm = z.infer<typeof paymentSchema>

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name.").max(255),
  contact: z.string().trim().max(100),
  address: z.string().trim(),
  notes: z.string().trim(),
  email: z.union([z.literal(""), z.email("Enter a valid email address.")]),
  category: z.string(), // optional: "" = none
  credit_limit: optionalAmount("Credit limit"),
  payment_terms_days: z.string().trim().refine((v) => v === "" || /^\d{1,3}$/.test(v), "Enter a whole number of days."),
  is_active: z.enum(YES_NO),
})
export type CustomerForm = z.infer<typeof customerSchema>

export const quotationSchema = z.object({
  customer: requiredId("a customer"),
  product: z.string(),
  fabric: z.string(), // optional until the order is made
  fabric_quality: z.string().trim().min(1, "Enter the quality.").max(100),
  weight: decimalString("the weight"),
  price_per_kg: decimalString("the price per kg"),
  discount_pct: percentString,
  tax_pct: percentString,
  valid_until: z.string(),
  notes: z.string().trim(),
})
export type QuotationForm = z.infer<typeof quotationSchema>

export const productSchema = z.object({
  name: z.string().trim().min(1, "Enter the product name.").max(150),
  material_type: z.string().trim().max(255),
  grade: z.string().trim().max(100),
  specification: z.string().trim(),
  price_per_kg: decimalString("the price per kg"),
  is_active: z.enum(YES_NO),
  prices: z.array(z.object({
    customer_category: z.enum(CUSTOMER_CATEGORIES),
    price_per_kg: decimalString("the price"),
  })).refine((rows) => new Set(rows.map((r) => r.customer_category)).size === rows.length, "Each customer category can have one price."),
})
export type ProductForm = z.infer<typeof productSchema>

export const returnSchema = z.object({
  order: requiredId("an order"),
  return_date: z.string().min(1, "Enter the return date."),
  weight: decimalString("the weight"),
  reason: z.string().trim().min(1, "Say why the goods came back."),
  restock: z.enum(YES_NO),
})
export type ReturnForm = z.infer<typeof returnSchema>

export const invoiceSchema = z.object({
  weight: decimalString("the weight"),
  invoice_date: z.string().min(1, "Enter the invoice date."),
  notes: z.string().trim(),
})
export type InvoiceForm = z.infer<typeof invoiceSchema>
