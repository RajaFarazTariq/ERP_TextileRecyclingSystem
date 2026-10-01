import { z } from "zod"

import { decimalString, requiredId } from "@/lib/forms"

export const STOCK_STATUSES = ["Received", "Pending", "Approved", "Rejected"] as const

export const stockSchema = z.object({
  vendor: requiredId("a vendor"),
  unit: requiredId("a factory unit"),
  fabric_type: z.string().trim().min(1, "Enter the fabric type.").max(100),
  vendor_weight_slip: z.string().trim().min(1, "Enter the vendor's weight slip number.").max(100),
  vehicle_no: z.string().trim().min(1, "Enter the vehicle number.").max(50),
  our_weight: decimalString("our weight"),
  unloading_weight: decimalString("unloading weight", { allowZero: true }),
  status: z.enum(STOCK_STATUSES),
  po_line: z.string(), // optional purchase order line
})
export type StockForm = z.infer<typeof stockSchema>

export const SUPPLIER_CATEGORIES = ["Textile waste", "Post-consumer", "Pre-consumer", "Chemicals", "Packaging", "Other"] as const

export const vendorSchema = z.object({
  name: z.string().trim().min(1, "Enter the vendor name.").max(255),
  contact: z.string().trim().max(100),
  address: z.string().trim(),
  email: z.string().trim().email("Enter a valid email address.").or(z.literal("")),
  category: z.string(),
  specialties: z.string().trim().max(255),
  payment_terms_days: z.string().trim().refine((v) => !v || /^\d{1,3}$/.test(v), "Enter a number of days."),
  is_active: z.boolean(),
})
export type VendorForm = z.infer<typeof vendorSchema>

export const unitSchema = z.object({
  name: z.string().trim().min(1, "Enter the unit name.").max(50),
})
export type UnitForm = z.infer<typeof unitSchema>
