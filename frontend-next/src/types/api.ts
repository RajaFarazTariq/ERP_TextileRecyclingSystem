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

export type DryerStatus = "Available" | "Running" | "Cooling" | "Maintenance"
export type DryerType = "Tumble" | "Conveyor" | "Chamber"

export interface Dryer {
  id: number
  name: string
  capacity: Decimal
  dryer_type: DryerType
  status: DryerStatus
  notes: string | null
  created_at: string
}

export type DryingStatus = "Pending" | "In Progress" | "Completed" | "Failed" | "On Hold"

export interface DryingSession {
  id: number
  dryer: number
  dryer_name: string
  fabric: number
  fabric_material: string
  decolor_session: number | null
  supervisor: number
  supervisor_name: string
  input_quantity: Decimal
  output_quantity: Decimal
  waste_quantity: Decimal
  temperature_celsius: Decimal | null
  duration_minutes: number | null
  status: DryingStatus
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
  moisture_loss_kg: number
  output_efficiency: number
}

/** Fabric lots that came out of decolorization (drying dropdown). */
export interface FabricReadyOption {
  id: number
  material_type: string
  status: string
  remaining_quantity: Decimal
}

/** Completed decolorization sessions not yet linked to a drying session. */
export interface DecolorDoneOption {
  id: number
  tank__name: string
  fabric__material_type: string
  output_quantity: Decimal
  end_date: string | null
}

export type OrderStatus = "Draft" | "Confirmed" | "Dispatched" | "Completed" | "Cancelled"
export type PaymentStatus = "Pending" | "Partial" | "Paid"
export type DispatchStatus = "Pending" | "Loading" | "Dispatched" | "Delivered"
export type PaymentMethod = "Cash" | "Bank Transfer" | "Cheque" | "Online Transfer"

export interface Dispatch {
  id: number
  sales_order: number
  order_buyer: string
  vehicle_number: string
  driver_name: string | null
  driver_contact: string | null
  dispatched_weight: Decimal
  dispatch_status: DispatchStatus
  dispatched_by: number
  dispatched_by_name: string
  dispatch_date: string
  delivery_date: string | null
  notes: string | null
}

export interface Payment {
  id: number
  sales_order: number
  amount: Decimal
  payment_method: PaymentMethod
  received_by: number
  received_by_name: string
  payment_date: string
  reference_number: string | null
  notes: string | null
}

export interface SalesOrder {
  id: number
  buyer_name: string
  buyer_contact: string | null
  buyer_address: string | null
  customer: number | null
  customer_name: string | null
  fabric: number
  fabric_material: string
  fabric_quality: string
  weight_sold: Decimal
  price_per_kg: Decimal
  total_price: Decimal
  payment_status: PaymentStatus
  status: OrderStatus
  created_by: number
  created_by_name: string
  created_at: string
  updated_at: string
  notes: string | null
  dispatches: Dispatch[]
  payments: Payment[]
}

export interface SalesSummary {
  total_orders: number
  total_revenue: number
  pending_payments: number
  completed_orders: number
  total_collected: number
  pending_amount: number
  paid_orders: number
  payment_count: number
}

export interface Customer {
  id: number
  name: string
  contact: string | null
  address: string | null
  notes: string | null
  created_at: string
  order_count: number
}

export interface CustomerDuplicate {
  a: { id: number; name: string }
  b: { id: number; name: string }
  similarity: number
}

/** DRF validation errors: {"field": ["message"]} or {"detail": "message"}. */
export type ApiErrorBody = Record<string, string[] | string> | { detail: string }
