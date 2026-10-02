import { z } from "zod"

import type { StatusTone } from "@/components/common/status-badge"
import { requiredId } from "@/lib/forms"
import type { AttendanceStatus, EmployeeStatus, LeaveStatus, TaskStatus } from "@/types/workforce"

export const EMPLOYMENT_TYPES = ["Permanent", "Contract", "Daily wage"] as const
export const EMPLOYEE_STATUSES = ["Active", "On leave", "Left"] as const
export const ATTENDANCE_STATUSES = ["Present", "Late", "Half day", "Absent", "Leave"] as const
export const LEAVE_TYPES = ["Annual", "Sick", "Casual", "Unpaid"] as const
export const TASK_AREAS = ["Warehouse", "Sorting", "Decolorization", "Drying", "Maintenance", "Other"] as const
export const TASK_STATUSES = ["Assigned", "In progress", "Done"] as const

export const EMPLOYEE_TONES: Record<EmployeeStatus, StatusTone> = { Active: "success", "On leave": "warning", Left: "neutral" }
export const ATTENDANCE_TONES: Record<AttendanceStatus, StatusTone> = {
  Present: "success", Late: "warning", "Half day": "info", Absent: "danger", Leave: "neutral",
}
export const LEAVE_TONES: Record<LeaveStatus, StatusTone> = { Pending: "warning", Approved: "success", Rejected: "danger" }
export const TASK_TONES: Record<TaskStatus, StatusTone> = { Assigned: "neutral", "In progress": "running", Done: "success" }

/** No hours are kept for these two */
export const notAtWork = (status: string) => status === "Absent" || status === "Leave"

const NUMBER = /^\d+(\.\d{1,2})?$/
const optionalNumber = (what: string) =>
  z.string().trim().refine((v) => !v || NUMBER.test(v), `${what} must be a number with up to 2 decimals.`)
const optionalHours = (what: string) =>
  optionalNumber(what).refine((v) => !v || Number(v) <= 24, `${what} can't be more than 24.`)
const yesNo = z.enum(["yes", "no"])

/** "06:00:00" → "06:00", for time inputs and display. */
export const shortTime = (value: string | null | undefined) => (value ? value.slice(0, 5) : "")

/** Hours between two "HH:MM" times; an end at or before the start is on the next day. */
export function hoursBetween(start: string, end: string): number | null {
  if (!start || !end) return null
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  let diff = minutes(end) - minutes(start)
  if (diff <= 0) diff += 24 * 60
  return Math.round((diff / 60) * 100) / 100
}

/** "8", "7.5": hours without trailing zeros. */
export const hours = (value: string | number | null | undefined) =>
  (Number(value) || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100),
  description: z.string().trim(),
  is_active: yesNo,
})
export type DepartmentForm = z.infer<typeof departmentSchema>

export const jobRoleSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(100),
  department: z.string(),
  description: z.string().trim(),
})
export type JobRoleForm = z.infer<typeof jobRoleSchema>

export const shiftSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100),
  start_time: z.string().min(1, "Enter the start time."),
  end_time: z.string().min(1, "Enter the end time."),
  is_active: yesNo,
}).refine((v) => !v.start_time || v.start_time !== v.end_time, {
  path: ["end_time"], message: "The end can't be the same as the start.",
})
export type ShiftForm = z.infer<typeof shiftSchema>

export const employeeSchema = z.object({
  full_name: z.string().trim().min(1, "Enter the full name.").max(150),
  department: requiredId("a department"),
  job_role: requiredId("a job role"),
  shift: z.string(),
  user: z.string(),
  phone: z.string().trim().max(30),
  cnic: z.string().trim().max(20),
  address: z.string().trim(),
  emergency_contact: z.string().trim().max(255),
  joined_on: z.string().min(1, "Enter the joining date."),
  employment_type: z.enum(EMPLOYMENT_TYPES),
  status: z.enum(EMPLOYEE_STATUSES),
  left_on: z.string(),
  notes: z.string().trim(),
}).refine((v) => v.status !== "Left" || !v.left_on || v.left_on >= v.joined_on, {
  path: ["left_on"], message: "The leaving date can't be before the joining date.",
})
export type EmployeeForm = z.infer<typeof employeeSchema>

export const attendanceSchema = z.object({
  employee: requiredId("an employee"),
  date: z.string().min(1, "Enter the date."),
  shift: z.string(),
  status: z.enum(ATTENDANCE_STATUSES),
  check_in: z.string(),
  check_out: z.string(),
  hours_worked: optionalHours("Hours worked"),
  overtime_hours: optionalHours("Overtime"),
  notes: z.string().trim().max(255),
}).refine((v) => notAtWork(v.status) || !v.check_out || !!v.check_in, {
  path: ["check_in"], message: "Enter the check-in time too.",
})
export type AttendanceForm = z.infer<typeof attendanceSchema>

export const leaveSchema = z.object({
  employee: requiredId("an employee"),
  leave_type: z.enum(LEAVE_TYPES),
  start_date: z.string().min(1, "Enter the first day."),
  end_date: z.string().min(1, "Enter the last day."),
  reason: z.string().trim(),
}).refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
  path: ["end_date"], message: "The last day can't be before the first day.",
})
export type LeaveForm = z.infer<typeof leaveSchema>

/** Days of leave, counting both the first and the last day. */
export function leaveDays(start: string, end: string): number | null {
  if (!start || !end || end < start) return null
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1
}

export const taskSchema = z.object({
  employee: requiredId("an employee"),
  title: z.string().trim().min(1, "Say what has to be done.").max(150),
  description: z.string().trim(),
  date: z.string().min(1, "Enter the date."),
  area: z.string(),
  reference: z.string().trim().max(150),
  status: z.enum(TASK_STATUSES),
  hours_spent: optionalNumber("Hours spent"),
  output_kg: optionalNumber("Output"),
})
export type TaskForm = z.infer<typeof taskSchema>
