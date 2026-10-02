import { z } from "zod"

import { decimalString, requiredId } from "@/lib/forms"
import type { StatusTone } from "@/lib/tones"
import type { TargetMetric, Utility, WasteClassification } from "@/types/sustainability"

export const CLASSIFICATIONS = ["Recyclable", "Reusable", "Hazardous", "General"] as const
export const CLASSIFICATION_LABELS: Record<WasteClassification, string> = {
  Recyclable: "Recyclable",
  Reusable: "Reusable",
  Hazardous: "Hazardous",
  General: "General / landfill",
}
export const CLASSIFICATION_TONES: Record<WasteClassification, StatusTone> = {
  Recyclable: "success",
  Reusable: "info",
  Hazardous: "danger",
  General: "neutral",
}

export const STAGES = ["Warehouse", "Sorting", "Decolorization", "Drying", "Other"] as const
export const METHODS = [
  "Recycled internally", "Sold as by-product", "Sent to recycler", "Reused", "Landfill", "Incinerated", "Treated",
] as const

export const UTILITIES = ["Water", "Electricity", "Gas", "Steam", "Diesel"] as const
// Same units as the server keeps (one per utility, so readings can be added up)
export const UTILITY_UNITS: Record<Utility, string> = {
  Water: "m3", Electricity: "kWh", Gas: "m3", Steam: "kg", Diesel: "litres",
}

export const METRICS = ["recovery_rate", "landfill_share", "water_per_kg", "energy_per_kg", "chemical_per_kg"] as const
export const METRIC_LABELS: Record<TargetMetric, string> = {
  recovery_rate: "Recovery rate %",
  landfill_share: "Waste to landfill %",
  water_per_kg: "Water per kg (litres)",
  energy_per_kg: "Energy per kg (kWh)",
  chemical_per_kg: "Chemical cost per kg (Rs.)",
}
/** The unit written after a target or actual value. */
export const METRIC_UNITS: Record<TargetMetric, string> = {
  recovery_rate: "%",
  landfill_share: "%",
  water_per_kg: "L per kg",
  energy_per_kg: "kWh per kg",
  chemical_per_kg: "Rs. per kg",
}
export const DIRECTIONS = ["At least", "At most"] as const

const optionalAmount = (label: string) =>
  z.string().trim().refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), `${label} must be a number with up to 2 decimals.`)

const notInFuture = (v: string) => {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  return v <= today
}
const pastDate = z.string().min(1, "Enter the date.").refine(notInFuture, "The date can't be in the future.")

export const wasteSchema = z.object({
  date: pastDate,
  category: requiredId("a waste category"),
  stage: z.enum(STAGES),
  quantity_kg: decimalString("the weight"),
  fabric: z.string(),
  disposal_method: z.string().min(1, "Choose how it was disposed of."),
  disposed_to: z.string().trim().max(255),
  disposal_cost: optionalAmount("The cost"),
  revenue: optionalAmount("The amount"),
  disposal_reference: z.string().trim().max(100),
  notes: z.string().trim(),
})
export type WasteForm = z.infer<typeof wasteSchema>

export const readingSchema = z.object({
  date: pastDate,
  utility: z.enum(UTILITIES),
  quantity: decimalString("the quantity"),
  cost: optionalAmount("The cost"),
  stage: z.string(),
  meter_reference: z.string().trim().max(100),
  notes: z.string().trim(),
})
export type ReadingForm = z.infer<typeof readingSchema>

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100),
  classification: z.enum(CLASSIFICATIONS),
  description: z.string().trim(),
  is_active: z.enum(["yes", "no"]),
})
export type CategoryForm = z.infer<typeof categorySchema>

export const targetSchema = z.object({
  metric: z.enum(METRICS),
  direction: z.enum(DIRECTIONS),
  target_value: decimalString("the target", { allowZero: true }),
  period: z.string().trim().max(50),
  is_active: z.enum(["yes", "no"]),
})
export type TargetForm = z.infer<typeof targetSchema>
