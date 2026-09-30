import { z } from "zod"

import { decimalString, requiredId } from "@/lib/forms"

export const ORDER_STATUSES = ["Draft", "Confirmed", "Dispatched", "Completed", "Cancelled"] as const
export const PAYMENT_STATUSES = ["Pending", "Partial", "Paid"] as const
export const DISPATCH_STATUSES = ["Pending", "Loading", "Dispatched", "Delivered"] as const
export const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Online Transfer"] as const

export const orderSchema = z.object({
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
})
export type CustomerForm = z.infer<typeof customerSchema>
