import { z } from "zod"

import { decimalString, requiredId } from "@/lib/forms"

export const SESSION_STATUSES = ["In Progress", "Completed", "On Hold"] as const
export const FABRIC_STATUSES = ["In Warehouse", "In Sorting", "Sorted", "Sent to Decolorization"] as const

export const sessionSchema = z.object({
  fabric: requiredId("a fabric lot"),
  supervisor: requiredId("a supervisor"),
  unit: z.string().min(1, "Choose a unit."),
  quantity_taken: decimalString("the quantity taken"),
  notes: z.string().trim(),
})
export type SessionForm = z.infer<typeof sessionSchema>

export const fabricSchema = z.object({
  stock: requiredId("the warehouse delivery"),
  material_type: z.string().trim().min(1, "Enter the material type.").max(255),
  initial_quantity: decimalString("the initial quantity"),
  status: z.enum(FABRIC_STATUSES),
})
export type FabricForm = z.infer<typeof fabricSchema>

export const completeSchema = z.object({
  quantity_sorted: decimalString("the sorted quantity", { allowZero: true }),
  waste_quantity: decimalString("the waste quantity", { allowZero: true }),
})
export type CompleteForm = z.infer<typeof completeSchema>
