import { z } from "zod"

import { decimalString, requiredId } from "@/lib/forms"

export const ORDER_STATUSES = ["Draft", "Released", "In Progress", "Completed", "Cancelled"] as const
export const PRIORITIES = ["Low", "Normal", "High"] as const
export const STAGE_MODULES = [
  { value: "", label: "None" },
  { value: "sorting", label: "Sorting" },
  { value: "decolorization", label: "Decolorization" },
  { value: "drying", label: "Drying" },
] as const

const optionalAmount = z.string().trim().refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), "Enter a number with up to 2 decimals.")
const activeFlag = z.enum(["yes", "no"])

export const orderSchema = z.object({
  product_name: z.string().trim().min(1, "Enter what is being produced.").max(255),
  fabric: requiredId("a fabric lot"),
  routing: requiredId("a routing"),
  bom: z.string(),
  unit: z.string(),
  planned_input_kg: decimalString("the planned input"),
  planned_output_kg: decimalString("the planned output"),
  planned_start: z.string().min(1, "Enter the start date."),
  planned_end: z.string().min(1, "Enter the end date."),
  priority: z.enum(PRIORITIES),
  notes: z.string().trim(),
}).superRefine((v, ctx) => {
  if (v.planned_end && v.planned_start && v.planned_end < v.planned_start) {
    ctx.addIssue({ code: "custom", path: ["planned_end"], message: "The end date can't be before the start date." })
  }
  if (Number(v.planned_output_kg) > Number(v.planned_input_kg)) {
    ctx.addIssue({ code: "custom", path: ["planned_output_kg"], message: "Planned output can't be more than the input." })
  }
})
export type OrderForm = z.infer<typeof orderSchema>

export const routingSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(150),
  description: z.string().trim(),
  is_active: activeFlag,
  steps: z.array(z.object({
    stage: requiredId("a stage"),
    planned_hours: optionalAmount,
    hourly_cost: optionalAmount,
  })).min(1, "Add at least one stage."),
})
export type RoutingForm = z.infer<typeof routingSchema>

export const bomSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(150),
  product_name: z.string().trim().max(255),
  is_active: activeFlag,
  notes: z.string().trim(),
  lines: z.array(z.object({
    material: z.string().trim().min(1, "Enter the material.").max(255),
    chemical: z.string(),
    quantity_per_100kg: decimalString("the quantity"),
    unit: z.string().trim().min(1, "Enter the unit.").max(20),
    unit_cost: optionalAmount,
  })).min(1, "Add at least one material."),
})
export type BomForm = z.infer<typeof bomSchema>

export const stageSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100),
  sequence: z.string().trim().refine((v) => /^\d{1,6}$/.test(v), "Enter a whole number."),
  module: z.enum(["", "sorting", "decolorization", "drying"]),
  is_active: activeFlag,
})
export type StageForm = z.infer<typeof stageSchema>

export const completeStepSchema = z.object({
  input_kg: decimalString("the input"),
  output_kg: decimalString("the output", { allowZero: true }),
  waste_kg: decimalString("the waste", { allowZero: true }),
  actual_hours: optionalAmount,
}).refine((v) => Number(v.output_kg) + Number(v.waste_kg) <= Number(v.input_kg), {
  path: ["output_kg"], message: "Output plus waste can't be more than the input.",
})
export type CompleteStepForm = z.infer<typeof completeStepSchema>

export const assignStepSchema = z.object({
  operator: z.string(),
  machine: z.string().trim().max(100),
  planned_hours: optionalAmount,
  hourly_cost: optionalAmount,
})
export type AssignStepForm = z.infer<typeof assignStepSchema>
