import { z } from "zod"

import { requiredId } from "@/lib/forms"
import type { Duty, QualityStage } from "@/types/api"

export const STAGES = ["Incoming", "In-process", "Finished"] as const
export const STAGE_LABELS: Record<QualityStage, string> = {
  Incoming: "Incoming material",
  "In-process": "In-process",
  Finished: "Finished product",
}
export const RESULTS = ["Pass", "Conditional", "Fail"] as const
export const CHECK_KINDS = ["Measure", "Pass/Fail"] as const
export const ACTION_KINDS = ["Corrective", "Preventive"] as const

// The duty needed to record inspections at each stage (same rule as the server)
const STAGE_DUTIES: Record<QualityStage, Duty> = {
  Incoming: "inspect_incoming",
  "In-process": "inspect_in_process",
  Finished: "inspect_finished",
}

export function stagesFor(can: (duty: Duty) => boolean): QualityStage[] {
  return STAGES.filter((s) => can(STAGE_DUTIES[s]))
}

const NUMBER = /^-?\d+(\.\d{1,2})?$/
const optionalNumber = z.string().trim().refine((v) => !v || NUMBER.test(v), "Enter a number with up to 2 decimals.")

const limits = { unit: z.string().trim().max(20), min_value: optionalNumber, max_value: optionalNumber }

/** Whether a checklist row passes; null while it isn't filled in yet. */
export function rowPassed(row: { kind: string; value: string; passed: string; min_value: string; max_value: string }): boolean | null {
  if (row.kind !== "Measure") return row.passed === "yes" ? true : row.passed === "no" ? false : null
  if (!NUMBER.test(row.value.trim())) return null
  const value = Number(row.value)
  return (row.min_value === "" || value >= Number(row.min_value)) && (row.max_value === "" || value <= Number(row.max_value))
}

export const inspectionSchema = z.object({
  stage: z.enum(STAGES),
  stock: z.string(),
  fabric: z.string(),
  standard: z.string(),
  inspected_on: z.string().min(1, "Enter the inspection date."),
  sample_kg: optionalNumber,
  composition: z.string().trim().max(255),
  result: z.enum(RESULTS),
  rejection_reason: z.string().trim(),
  notes: z.string().trim(),
  results: z.array(z.object({
    name: z.string().trim().min(1, "Name the check.").max(150),
    kind: z.enum(CHECK_KINDS),
    ...limits,
    value: z.string().trim(),
    passed: z.enum(["", "yes", "no"]),
    custom: z.boolean(),
  })),
}).superRefine((v, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message })
  if (v.stage === "Incoming" && !v.stock) issue(["stock"], "Choose the delivery that was inspected.")
  if (v.stage !== "Incoming" && !v.fabric) issue(["fabric"], "Choose the fabric lot that was inspected.")
  v.results.forEach((row, i) => {
    if (row.kind === "Measure" && !NUMBER.test(row.value)) issue(["results", i, "value"], `Enter the measured value for ${row.name || "this check"}.`)
    if (row.kind === "Pass/Fail" && !row.passed) issue(["results", i, "passed"], `Mark ${row.name || "this check"} as passed or failed.`)
  })
  if (v.result === "Pass" && v.results.some((row) => rowPassed(row) === false)) {
    issue(["result"], "A check failed, so the result can't be Pass. Choose Conditional or Fail.")
  }
  if (v.result === "Fail" && !v.rejection_reason) issue(["rejection_reason"], "Say why the material failed.")
  if (v.result === "Conditional" && !v.notes) issue(["notes"], "Write the condition under which the material is accepted.")
})
export type InspectionForm = z.infer<typeof inspectionSchema>

export const standardSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(150),
  stage: z.enum(STAGES),
  material_type: z.string().trim().max(255),
  is_active: z.enum(["yes", "no"]),
  notes: z.string().trim(),
  checks: z.array(z.object({
    name: z.string().trim().min(1, "Name the check.").max(150),
    kind: z.enum(CHECK_KINDS),
    ...limits,
  }).superRefine((c, ctx) => {
    if (c.kind !== "Measure") return
    if (!c.min_value && !c.max_value) ctx.addIssue({ code: "custom", path: ["min_value"], message: "Give a measurement a minimum, a maximum or both." })
    else if (c.min_value && c.max_value && Number(c.min_value) > Number(c.max_value)) {
      ctx.addIssue({ code: "custom", path: ["min_value"], message: "The minimum can't be above the maximum." })
    }
  })).min(1, "Add at least one check."),
})
export type StandardForm = z.infer<typeof standardSchema>

export const actionSchema = z.object({
  inspection: requiredId("an inspection"),
  kind: z.enum(ACTION_KINDS),
  description: z.string().trim().min(1, "Describe what has to be done."),
  owner: z.string(),
  due_date: z.string(),
})
export type ActionForm = z.infer<typeof actionSchema>

/** "max 12 %", "5 – 8 %", "min 20 N" */
export function limitText(check: { min_value: string | null; max_value: string | null; unit: string }): string {
  const low = check.min_value ? Number(check.min_value) : null
  const high = check.max_value ? Number(check.max_value) : null
  const unit = check.unit ? ` ${check.unit}` : ""
  if (low !== null && high !== null) return `${low} – ${high}${unit}`
  if (high !== null) return `max ${high}${unit}`
  if (low !== null) return `min ${low}${unit}`
  return ""
}
