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

export type TankStatus = "Empty" | "Filled" | "Processing" | "Completed" | "Cleaning"

export interface Tank {
  id: number
  name: string
  batch_id: string
  capacity: Decimal
  fabric: number | null
  fabric_material: string | null
  fabric_quantity: Decimal
  tank_status: TankStatus
  supervisor: number | null
  supervisor_name: string | null
  start_date: string | null
  expected_completion: string | null
  actual_completion: string | null
  notes: string | null
  created_at: string
}

export interface Chemical {
  id: number
  chemical_name: string
  total_stock: Decimal
  issued_quantity: Decimal
  remaining_stock: Decimal
  unit_of_measure: string
  last_updated: string
}

export interface ChemicalIssuance {
  id: number
  chemical: number
  chemical_name: string
  tank: number
  tank_name: string
  issued_by: number
  issued_by_name: string
  quantity: Decimal
  issued_at: string
  notes: string | null
}

export type ProcessStatus = "In Progress" | "Completed" | "Failed" | "On Hold"

export interface DecolorizationSession {
  id: number
  tank: number
  tank_name: string
  fabric: number
  fabric_material: string
  supervisor: number
  supervisor_name: string
  input_quantity: Decimal
  output_quantity: Decimal
  waste_quantity: Decimal
  status: ProcessStatus
  start_date: string
  end_date: string | null
  notes: string | null
}

/** Lightweight fabric list for decolorization dropdowns. */
export interface FabricOption {
  id: number
  material_type: string
  status: string
}

/** DRF validation errors: {"field": ["message"]} or {"detail": "message"}. */
export type ApiErrorBody = Record<string, string[] | string> | { detail: string }
