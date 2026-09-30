import { z } from "zod"

import { decimalString, requiredId } from "@/lib/forms"

export const TANK_STATUSES = ["Empty", "Filled", "Processing", "Completed", "Cleaning"] as const
export const SESSION_STATUSES = ["In Progress", "Completed", "Failed", "On Hold"] as const
export const UNITS_OF_MEASURE = ["Liters", "Kg", "Grams"] as const

/** Share of stock left below which a chemical is flagged (same as the email alert). */
export const LOW_STOCK_SHARE = 0.25

export const tankSchema = z.object({
  name: z.string().trim().min(1, "Enter the tank name.").max(100),
  batch_id: z.string().trim().min(1, "Enter the batch ID.").max(100),
  capacity: decimalString("the capacity"),
  fabric_quantity: decimalString("the current load", { allowZero: true }),
  fabric: z.string(), // optional: "" = none
  tank_status: z.enum(TANK_STATUSES),
})
export type TankForm = z.infer<typeof tankSchema>

export const chemicalSchema = z.object({
  chemical_name: z.string().trim().min(1, "Enter the chemical name.").max(255),
  total_stock: decimalString("the total stock"),
  unit_of_measure: z.enum(UNITS_OF_MEASURE),
})
export type ChemicalForm = z.infer<typeof chemicalSchema>

export const issuanceSchema = z.object({
  chemical: requiredId("a chemical"),
  tank: requiredId("a tank"),
  issued_by: z.string(), // optional: defaults to you
  quantity: decimalString("the quantity"),
  notes: z.string().trim(),
})
export type IssuanceForm = z.infer<typeof issuanceSchema>

export const sessionSchema = z.object({
  tank: requiredId("a tank"),
  fabric: requiredId("a fabric lot"),
  supervisor: requiredId("a supervisor"),
  input_quantity: decimalString("the input quantity"),
  notes: z.string().trim(),
})
export type SessionForm = z.infer<typeof sessionSchema>

export const completeSchema = z.object({
  output_quantity: decimalString("the output quantity", { allowZero: true }),
  waste_quantity: decimalString("the waste quantity", { allowZero: true }),
})
export type CompleteForm = z.infer<typeof completeSchema>
