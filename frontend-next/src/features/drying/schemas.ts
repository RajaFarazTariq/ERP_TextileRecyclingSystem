import { z } from "zod"

import { decimalString, requiredId } from "@/lib/forms"

export const DRYER_STATUSES = ["Available", "Running", "Cooling", "Maintenance"] as const
export const DRYER_TYPES = ["Tumble", "Conveyor", "Chamber"] as const
export const SESSION_STATUSES = ["Pending", "In Progress", "Completed", "Failed", "On Hold"] as const

const optionalNumber = (label: string, { integer = false } = {}) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (integer ? /^\d+$/.test(v) : /^\d+(\.\d)?$/.test(v)),
      `${label} must be a ${integer ? "whole number" : "number with up to 1 decimal"}.`)

export const dryerSchema = z.object({
  name: z.string().trim().min(1, "Enter the dryer name.").max(100),
  dryer_type: z.enum(DRYER_TYPES),
  capacity: decimalString("the capacity"),
  status: z.enum(DRYER_STATUSES),
  notes: z.string().trim(),
})
export type DryerForm = z.infer<typeof dryerSchema>

export const sessionSchema = z.object({
  dryer: requiredId("a dryer"),
  fabric: requiredId("a fabric lot"),
  decolor_session: z.string(), // optional link
  supervisor: requiredId("a supervisor"),
  input_quantity: decimalString("the input quantity"),
  temperature_celsius: optionalNumber("Temperature"),
  duration_minutes: optionalNumber("Duration", { integer: true }),
  status: z.enum(SESSION_STATUSES),
  notes: z.string().trim(),
})
export type SessionForm = z.infer<typeof sessionSchema>

export const completeSchema = z.object({
  output_quantity: decimalString("the output quantity", { allowZero: true }),
  waste_quantity: decimalString("the waste quantity", { allowZero: true }),
  notes: z.string().trim(),
})
export type CompleteForm = z.infer<typeof completeSchema>
