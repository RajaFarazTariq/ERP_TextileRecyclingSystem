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

/** An optional number typed into a text box: "" or digits with up to `decimals` decimals. */
const optionalNumber = (label: string, decimals = 2) =>
  z.string().trim().refine(
    (v) => v === "" || new RegExp(decimals ? `^\\d+(\\.\\d{1,${decimals}})?$` : "^\\d+$").test(v),
    decimals ? `${label} must be a number with up to ${decimals} decimal${decimals === 1 ? "" : "s"}.` : `${label} must be a whole number.`,
  )
const YES_NO = ["yes", "no"] as const

export const HAZARD_CLASSES = ["Corrosive", "Oxidizer", "Flammable", "Toxic", "Irritant", "Environmental hazard"] as const

export const chemicalSchema = z.object({
  chemical_name: z.string().trim().min(1, "Enter the chemical name.").max(255),
  total_stock: decimalString("the total stock"),
  unit_of_measure: z.enum(UNITS_OF_MEASURE),
  unit_cost: optionalNumber("Cost"),
  supplier: z.string(), // optional: "" = none
  hazard_class: z.string().trim().max(100),
  handling_notes: z.string().trim(),
  sds_reference: z.string().trim().max(255),
  is_restricted: z.enum(YES_NO),
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
  recipe_version: z.string(), // optional: "" = none
  temperature_c: optionalNumber("Temperature", 1),
  duration_minutes: optionalNumber("Duration", 0),
  water_liters: optionalNumber("Water"),
})
export type SessionForm = z.infer<typeof sessionSchema>

export const completeSchema = z.object({
  output_quantity: decimalString("the output quantity", { allowZero: true }),
  waste_quantity: decimalString("the waste quantity", { allowZero: true }),
})
export type CompleteForm = z.infer<typeof completeSchema>

export const lotSchema = z.object({
  chemical: requiredId("a chemical"),
  lot_number: z.string().trim().min(1, "Enter the lot number.").max(100),
  received_on: z.string().min(1, "Enter the date it was received."),
  quantity: decimalString("the quantity"),
  unit_cost: optionalNumber("Cost"),
  supplier: z.string(), // optional: "" = none
  expiry_date: z.string(),
  notes: z.string().trim(),
}).refine((v) => !v.expiry_date || v.expiry_date >= v.received_on, {
  path: ["expiry_date"], message: "Can't be before the date it was received.",
})
export type LotForm = z.infer<typeof lotSchema>

export const recipeSchema = z.object({
  name: z.string().trim().min(1, "Enter the recipe name.").max(150),
  material_type: z.string().trim().max(255),
  is_active: z.enum(YES_NO),
  temperature_c: optionalNumber("Temperature", 1),
  duration_minutes: optionalNumber("Duration", 0),
  water_liters_per_100kg: optionalNumber("Water"),
  change_note: z.string().trim(),
  lines: z.array(z.object({
    chemical: requiredId("a chemical"),
    quantity_per_100kg: decimalString("the quantity"),
  })).min(1, "Add at least one chemical.")
    .refine((lines) => new Set(lines.map((l) => l.chemical)).size === lines.length, "Each chemical can be listed once."),
})
export type RecipeForm = z.infer<typeof recipeSchema>
