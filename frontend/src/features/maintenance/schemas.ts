import { z } from "zod"

import type { StatusTone } from "@/components/common/status-badge"
import { decimalString, requiredId } from "@/lib/forms"
import type { MachineStatus, WorkOrderPriority, WorkOrderStatus } from "@/types/maintenance"

export const MACHINE_STATUSES = ["Running", "Idle", "Under maintenance", "Broken down", "Retired"] as const
export const CATEGORIES = ["Sorting line", "Tank", "Dryer", "Baler", "Shredder", "Utility"]
export const KINDS = ["Corrective", "Preventive"] as const
export const PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const
export const ORDER_STATUSES = ["Open", "In progress", "Done", "Cancelled"] as const

export const MACHINE_TONES: Record<MachineStatus, StatusTone> = {
  Running: "success", Idle: "neutral", "Under maintenance": "warning", "Broken down": "danger", Retired: "neutral",
}
export const ORDER_TONES: Record<WorkOrderStatus, StatusTone> = {
  Open: "warning", "In progress": "running", Done: "success", Cancelled: "neutral",
}
export const PRIORITY_TONES: Record<WorkOrderPriority, StatusTone> = {
  Low: "neutral", Normal: "info", High: "warning", Urgent: "danger",
}

const optionalMoney = z.string().trim().refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), "Enter a number with up to 2 decimals.")
const wholeNumber = (message: string) => z.string().trim().refine((v) => !v || /^\d+$/.test(v), message)

export const machineSchema = z.object({
  code: z.string().trim().min(1, "Enter a code.").max(30),
  name: z.string().trim().min(1, "Enter a name.").max(150),
  category: z.string().trim().max(60),
  location: z.string().trim().max(120),
  manufacturer: z.string().trim().max(120),
  model: z.string().trim().max(120),
  serial_number: z.string().trim().max(120),
  specifications: z.string().trim(),
  installed_on: z.string(),
  status: z.enum(MACHINE_STATUSES),
  hourly_operating_cost: optionalMoney,
  notes: z.string().trim(),
  // "tank-3" or "dryer-2": a machine is linked to one piece of process equipment at most
  equipment: z.string(),
})
export type MachineForm = z.infer<typeof machineSchema>

export const scheduleSchema = z.object({
  machine: requiredId("a machine"),
  task: z.string().trim().min(1, "Name the task.").max(150),
  every_days: z.string().trim().refine((v) => /^\d+$/.test(v) && Number(v) >= 1, "Enter a number of days, 1 or more."),
  start_date: z.string().min(1, "Enter the first due date."),
  last_done_on: z.string(),
  instructions: z.string().trim(),
  is_active: z.enum(["yes", "no"]),
})
export type ScheduleForm = z.infer<typeof scheduleSchema>

export const workOrderSchema = z.object({
  machine: requiredId("a machine"),
  kind: z.enum(KINDS),
  title: z.string().trim().min(1, "Say what is wrong or what has to be done.").max(200),
  description: z.string().trim(),
  priority: z.enum(PRIORITIES),
  is_breakdown: z.enum(["yes", "no"]),
  assigned_to: z.string(),
})
export type WorkOrderForm = z.infer<typeof workOrderSchema>

export const completeSchema = z.object({
  work_done: z.string().trim().min(1, "Describe the work that was done."),
  downtime_minutes: wholeNumber("Enter whole minutes."),
  labour_hours: optionalMoney,
  labour_cost: optionalMoney,
  other_cost: optionalMoney,
})
export type CompleteForm = z.infer<typeof completeSchema>

export const partSchema = z.object({
  code: z.string().trim().min(1, "Enter a code.").max(30),
  name: z.string().trim().min(1, "Enter a name.").max(150),
  unit: z.string().trim().min(1, "Enter a unit, e.g. pcs.").max(20),
  stock_quantity: optionalMoney,
  reorder_level: optionalMoney,
  unit_cost: optionalMoney,
  location: z.string().trim().max(120),
})
export type PartForm = z.infer<typeof partSchema>

export const receiveSchema = z.object({
  quantity: decimalString("the quantity"),
  unit_cost: optionalMoney,
})
export type ReceiveForm = z.infer<typeof receiveSchema>

export const partUseSchema = z.object({
  part: requiredId("a part"),
  quantity: decimalString("the quantity"),
})
export type PartUseForm = z.infer<typeof partUseSchema>

/** "1 h 30 min", "45 min" */
export function minutesText(minutes: number): string {
  if (!minutes) return "None"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ")
}

/** "Due in 5 days", "Due today", "12 days overdue" */
export function dueText(days: number): string {
  if (days === 0) return "Due today"
  const n = Math.abs(days)
  return days > 0 ? `Due in ${n} day${n === 1 ? "" : "s"}` : `${n} day${n === 1 ? "" : "s"} overdue`
}
