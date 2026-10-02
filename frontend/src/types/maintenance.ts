// API types for the Maintenance module.

type Decimal = string

export type MachineStatus = "Running" | "Idle" | "Under maintenance" | "Broken down" | "Retired"
export type WorkOrderKind = "Preventive" | "Corrective"
export type WorkOrderPriority = "Low" | "Normal" | "High" | "Urgent"
export type WorkOrderStatus = "Open" | "In progress" | "Done" | "Cancelled"

export interface Machine {
  id: number
  code: string
  name: string
  category: string
  location: string
  manufacturer: string
  model: string
  serial_number: string
  specifications: string
  installed_on: string | null
  status: MachineStatus
  hourly_operating_cost: Decimal
  notes: string
  tank: number | null
  tank_name: string | null
  dryer: number | null
  dryer_name: string | null
  open_work_orders: number
  created_at: string
}

export interface MaintenanceSchedule {
  id: number
  machine: number
  machine_code: string
  machine_name: string
  task: string
  every_days: number
  start_date: string
  last_done_on: string | null
  next_due_on: string
  instructions: string
  is_active: boolean
  overdue: boolean
  days_until_due: number
  /** Number of the work order still open for this schedule */
  open_work_order: string | null
  created_at: string
}

export interface PartUse {
  id: number
  work_order: number
  work_order_number: string
  part: number
  part_code: string
  part_name: string
  unit: string
  quantity: Decimal
  unit_cost: Decimal
  cost: Decimal
  used_by: number
  used_by_name: string
  created_at: string
}

export interface WorkOrder {
  id: number
  number: string
  machine: number
  machine_code: string
  machine_name: string
  kind: WorkOrderKind
  schedule: number | null
  schedule_task: string | null
  title: string
  description: string
  priority: WorkOrderPriority
  status: WorkOrderStatus
  is_breakdown: boolean
  reported_by: number
  reported_by_name: string
  assigned_to: number | null
  assigned_to_name: string | null
  reported_at: string
  started_at: string | null
  completed_at: string | null
  downtime_minutes: number
  labour_hours: Decimal
  labour_cost: Decimal
  other_cost: Decimal
  work_done: string
  parts: PartUse[]
  parts_cost: Decimal
  total_cost: Decimal
}

export interface SparePart {
  id: number
  code: string
  name: string
  unit: string
  stock_quantity: Decimal
  reorder_level: Decimal
  unit_cost: Decimal
  location: string
  low: boolean
  stock_value: Decimal
  created_at: string
}

export interface MaintenanceSummary {
  machines: number
  machines_by_status: { status: MachineStatus; count: number }[]
  open_work_orders: number
  in_progress_work_orders: number
  urgent_work_orders: number
  overdue_schedules: {
    id: number
    task: string
    machine_code: string
    machine_name: string
    next_due_on: string
    days_overdue: number
  }[]
  due_this_week: number
  breakdowns_this_month: number
  downtime_hours_this_month: Decimal
  cost_this_month: Decimal
  low_parts: { id: number; code: string; name: string; unit: string; stock_quantity: Decimal; reorder_level: Decimal }[]
}

export interface MachinePerformance {
  machine: number
  code: string
  name: string
  category: string
  status: MachineStatus
  work_orders: number
  breakdowns: number
  downtime_hours: Decimal
  cost: Decimal
  /** Downtime hours times the machine's hourly operating cost */
  downtime_cost: Decimal
  /** Mean time between failures; null with fewer than two breakdowns */
  mtbf_days: number | null
  availability_pct: number
}

export interface MaintenancePerformance {
  start: string
  end: string
  days: number
  breakdowns: number
  downtime_hours: Decimal
  cost: Decimal
  availability_pct: number | null
  machines: MachinePerformance[]
  impact: {
    machine: number
    code: string
    name: string
    equipment: string
    equipment_kind: "Tank" | "Dryer"
    downtime_hours: Decimal
    breakdowns: number
    sessions: number
  }[]
}
