// Types for the Django API (/api/v1/). Decimal fields arrive as strings.

export type Role =
  | "admin"
  | "warehouse_supervisor"
  | "sorting_supervisor"
  | "decolorization_supervisor"
  | "drying_supervisor"

export interface SessionUser {
  id: number
  username: string
  email: string
  role: Role
}

export type Decimal = string

export type StockStatus = "Received" | "Pending" | "Approved" | "Rejected"

export interface Vendor {
  id: number
  name: string
  contact: string | null
  address: string | null
  created_at: string
}

export interface FactoryUnit {
  id: number
  name: string
}

export interface StockEntry {
  id: number
  vendor: number
  vendor_name: string
  unit: number
  unit_name: string
  fabric_type: string
  vendor_weight_slip: string
  vehicle_no: string
  our_weight: Decimal
  unloading_weight: Decimal
  status: StockStatus
  created_at: string
}

export interface UserSummary {
  id: number
  username: string
  email: string
  role: Role
  is_active: boolean
}

export type FabricStatus = "In Warehouse" | "In Sorting" | "Sorted" | "Sent to Decolorization"

export interface FabricLot {
  id: number
  stock: number
  stock_fabric_type: string
  stock_vendor: string
  material_type: string
  initial_quantity: Decimal
  sorted_quantity: Decimal
  remaining_quantity: Decimal
  status: FabricStatus
  /** Sellable dried stock (inventory ledger), in kg */
  dried_available_kg: number
  created_at: string
  updated_at: string
}

export type SortingStatus = "In Progress" | "Completed" | "On Hold"

export interface SortingSession {
  id: number
  fabric: number
  fabric_material: string
  supervisor: number
  supervisor_name: string
  unit: string
  quantity_taken: Decimal
  quantity_sorted: Decimal
  waste_quantity: Decimal
  status: SortingStatus
  start_date: string
  end_date: string | null
  notes: string | null
}

/** DRF validation errors: {"field": ["message"]} or {"detail": "message"}. */
export type ApiErrorBody = Record<string, string[] | string> | { detail: string }
