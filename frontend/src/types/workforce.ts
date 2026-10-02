// API types for the Workforce module.
import type { Decimal } from "./api"

export type EmploymentType = "Permanent" | "Contract" | "Daily wage"
export type EmployeeStatus = "Active" | "On leave" | "Left"
export type AttendanceStatus = "Present" | "Absent" | "Late" | "Half day" | "Leave"
export type LeaveType = "Annual" | "Sick" | "Casual" | "Unpaid"
export type LeaveStatus = "Pending" | "Approved" | "Rejected"
export type TaskArea = "Warehouse" | "Sorting" | "Decolorization" | "Drying" | "Maintenance" | "Other"
export type TaskStatus = "Assigned" | "In progress" | "Done"

export interface Department {
  id: number
  name: string
  description: string
  is_active: boolean
  /** Current staff (people who left are not counted) */
  employees: number
}

export interface JobRole {
  id: number
  title: string
  department: number | null
  department_name: string | null
  description: string
}

export interface Shift {
  id: number
  name: string
  /** "HH:MM:SS" */
  start_time: string
  end_time: string
  is_active: boolean
  hours: Decimal
}

export interface Employee {
  id: number
  number: string
  full_name: string
  department: number
  department_name: string
  job_role: number
  job_role_title: string
  shift: number | null
  shift_name: string | null
  user: number | null
  username: string | null
  phone: string
  cnic: string
  address: string
  emergency_contact: string
  joined_on: string
  employment_type: EmploymentType
  status: EmployeeStatus
  left_on: string | null
  notes: string
  created_at: string
}

export interface Attendance {
  id: number
  employee: number
  employee_name: string
  employee_number: string
  department_name: string
  date: string
  shift: number | null
  shift_name: string | null
  status: AttendanceStatus
  check_in: string | null
  check_out: string | null
  hours_worked: Decimal
  overtime_hours: Decimal
  notes: string
}

/** One line of the daily attendance sheet. */
export interface SheetRow {
  employee: number
  number: string
  full_name: string
  department_name: string
  job_role_title: string
  shift: number | null
  shift_name: string | null
  /** Has approved leave on this date */
  on_leave: boolean
  leave_type: LeaveType | null
  record: Attendance | null
}

export interface AttendanceSheet {
  date: string
  rows: SheetRow[]
}

export interface LeaveRequest {
  id: number
  employee: number
  employee_name: string
  employee_number: string
  department_name: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  days: number
  reason: string
  status: LeaveStatus
  decided_by: number | null
  decided_by_name: string | null
  decided_at: string | null
  decision_note: string
  created_at: string
}

export interface TaskAssignment {
  id: number
  employee: number
  employee_name: string
  employee_number: string
  title: string
  description: string
  date: string
  area: TaskArea | ""
  reference: string
  status: TaskStatus
  hours_spent: Decimal | null
  output_kg: Decimal | null
  assigned_by: number | null
  assigned_by_name: string | null
  created_at: string
}

export interface WorkforceSummary {
  active_employees: number
  /** Everyone who hasn't left, including people on long leave */
  employees: number
  by_department: { department: number; name: string; employees: number }[]
  present_today: number
  late_today: number
  absent_today: number
  on_leave_today: number
  not_marked_today: number
  pending_leave_requests: number
  open_tasks: number
  hours_this_month: Decimal
  overtime_this_month: Decimal
  trend: { date: string; Present: number; Late: number; "Half day": number; Absent: number; Leave: number }[]
}

export interface ProductivityFigures {
  days_present: number
  absences: number
  late_days: number
  leave_days: number
  hours_worked: Decimal
  overtime_hours: Decimal
  tasks_done: number
  output_kg: Decimal
  /** From finished tasks that have both an output and hours; null when there are none */
  kg_per_hour: Decimal | null
}

export interface ProductivityRow extends ProductivityFigures {
  employee: number
  number: string
  full_name: string
  department_name: string
  job_role_title: string
}

export interface DepartmentProductivity extends ProductivityFigures {
  department: number
  name: string
  employees: number
}

export interface Productivity {
  employees: ProductivityRow[]
  departments: DepartmentProductivity[]
  totals: ProductivityFigures & { employees: number }
}
