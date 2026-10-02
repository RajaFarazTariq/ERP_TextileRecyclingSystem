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
  /** Pages this user may open ("sales", "finance", ...). Decided by Django; see /users → Access. */
  pages: string[]
}

export type Decimal = string

export type StockStatus = "Received" | "Pending" | "Approved" | "Rejected"

export interface Vendor {
  id: number
  name: string
  contact: string | null
  address: string | null
  email: string
  category: SupplierCategory | ""
  specialties: string
  payment_terms_days: number | null
  is_active: boolean
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
  /** Purchase order line this delivery was received against (optional) */
  po_line: number | null
  po_number: string | null
  po_material: string | null
  /** Latest quality inspection; null when the delivery was never inspected */
  qc_status: "Pass" | "Conditional" | "Quarantined" | "Released" | null
  created_at: string
}

export interface UserSummary {
  id: number
  username: string
  email: string
  role: Role
  is_active: boolean
  last_login: string | null
  last_login_display: string
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
  /** Held by a failed quality inspection until an admin releases it */
  quarantined: boolean
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
  /** Rs. per unit of measure */
  unit_cost: Decimal
  supplier: number | null
  supplier_name: string | null
  hazard_class: string
  handling_notes: string
  /** Where the safety data sheet is kept: a link or a file reference */
  sds_reference: string
  /** Only an admin may issue it */
  is_restricted: boolean
}

export interface ChemicalLot {
  id: number
  chemical: number
  chemical_name: string
  unit_of_measure: string
  lot_number: string
  supplier: number | null
  supplier_name: string | null
  received_on: string
  quantity: Decimal
  unit_cost: Decimal
  expiry_date: string | null
  expired: boolean
  notes: string
  received_by: number
  received_by_name: string
  created_at: string
}

export interface RecipeLine {
  id: number
  chemical: number
  chemical_name: string
  unit_of_measure: string
  quantity_per_100kg: Decimal
}

export interface RecipeVersion {
  id: number
  version: number
  temperature_c: Decimal | null
  duration_minutes: number | null
  water_liters_per_100kg: Decimal | null
  notes: string
  created_by: number
  created_by_name: string
  created_at: string
  lines: RecipeLine[]
  /** Sessions run with this version */
  sessions: number
}

export interface Recipe {
  id: number
  name: string
  material_type: string
  is_active: boolean
  created_at: string
  /** Newest first */
  versions: RecipeVersion[]
}

export interface ConsumptionLine {
  chemical: number
  chemical_name: string
  unit: string
  planned: Decimal
  actual: Decimal
  variance: Decimal
  planned_cost: Decimal
  actual_cost: Decimal
}

/** Planned (recipe) against issued chemicals for one decolorization session. */
export interface Consumption {
  session: number
  recipe: string | null
  input_quantity: Decimal
  lines: ConsumptionLine[]
  planned_cost: Decimal
  actual_cost: Decimal
  cost_per_kg: Decimal | null
  process: {
    planned_temperature_c: Decimal | null
    temperature_c: Decimal | null
    planned_duration_minutes: number | null
    duration_minutes: number | null
    planned_water_liters: Decimal | null
    water_liters: Decimal | null
  }
}

export interface ChemicalUsage {
  chemicals: { chemical: number; chemical_name: string; unit: string; quantity: Decimal; cost: Decimal; issuances: number }[]
  total_cost: Decimal
  issuances: number
  batches: number
  treated_kg: Decimal
  /** Cost of the issuances that are tied to a batch */
  batch_cost: Decimal
  cost_per_kg: Decimal | null
}

export interface SupplierOption {
  id: number
  name: string
  is_active: boolean
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
  /** The batch it was used on, when the tank had one running */
  session: number | null
  unit_of_measure: string
  /** Cost per unit when issued */
  unit_cost: Decimal
  cost: Decimal
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
  recipe_version: number | null
  /** e.g. "Cotton bleach v2" */
  recipe_name: string | null
  temperature_c: Decimal | null
  duration_minutes: number | null
  water_liters: Decimal | null
  approved_by: number | null
  approved_by_name: string | null
  approved_at: string | null
  /** Cost of the chemicals issued to this batch */
  chemical_cost: Decimal
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
  /** Delivery challan number, e.g. DC-00012 */
  challan_number: string
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
  product: number | null
  product_name: string | null
  discount_pct: Decimal
  tax_pct: Decimal
  /** The quotation this order came from */
  quotation_number: string | null
  invoiced_weight: Decimal
  /** Weight on returns that are requested or approved */
  returned_weight: Decimal
  /** Credits from approved returns; they reduce what the order owes */
  credited: Decimal
}

export type CustomerCategory = "Wholesaler" | "Manufacturer" | "Exporter" | "Retailer" | "Other"

export interface ProductPrice {
  id: number
  customer_category: CustomerCategory
  price_per_kg: Decimal
}

export interface Product {
  id: number
  name: string
  material_type: string
  grade: string
  specification: string
  /** List price; `prices` holds the price per customer category */
  price_per_kg: Decimal
  is_active: boolean
  created_at: string
  prices: ProductPrice[]
}

export type QuotationStatus = "Draft" | "Sent" | "Accepted" | "Rejected" | "Converted"

export interface SalesQuotation {
  id: number
  number: string
  customer: number
  customer_name: string
  product: number | null
  product_name: string | null
  fabric: number | null
  fabric_material: string | null
  fabric_quality: string
  weight: Decimal
  price_per_kg: Decimal
  discount_pct: Decimal
  tax_pct: Decimal
  total: Decimal
  valid_until: string | null
  expired: boolean
  status: QuotationStatus
  notes: string
  rejection_reason: string
  decided_at: string | null
  order: number | null
  created_by: number
  created_by_name: string
  created_at: string
}

export type InvoiceStatus = "Paid" | "Partial" | "Unpaid" | "Overdue"

export interface SalesInvoice {
  id: number
  number: string
  order: number
  customer_name: string
  customer_contact: string | null
  customer_address: string | null
  fabric_material: string
  fabric_quality: string
  invoice_date: string
  due_date: string
  weight: Decimal
  price_per_kg: Decimal
  subtotal: Decimal
  discount_pct: Decimal
  discount_amount: Decimal
  tax_pct: Decimal
  tax_amount: Decimal
  total: Decimal
  /** Settled by the order's payments and return credits, oldest invoice first */
  paid: Decimal
  status: InvoiceStatus
  notes: string
  created_by: number
  created_by_name: string
  created_at: string
}

export type ReturnStatus = "Requested" | "Approved" | "Rejected"

export interface SalesReturn {
  id: number
  number: string
  order: number
  customer_name: string
  fabric_material: string
  return_date: string
  weight: Decimal
  reason: string
  /** Put the returned weight back into sellable stock when approved */
  restock: boolean
  status: ReturnStatus
  credit_amount: Decimal
  rejection_reason: string
  decided_by: number | null
  decided_by_name: string | null
  decided_at: string | null
  created_by: number
  created_by_name: string
  created_at: string
}

export interface CustomerStatement {
  customer: number
  name: string
  as_of: string
  billed: Decimal
  paid: Decimal
  credited: Decimal
  balance: Decimal
  overdue: Decimal
  credit_limit: Decimal
  over_limit: boolean
  transactions: {
    date: string; kind: "Order" | "Payment" | "Return"; reference: string; detail: string
    debit: Decimal; credit: Decimal; balance: Decimal
  }[]
}

export interface PerformanceRow {
  name: string
  orders: number
  kg: Decimal
  revenue: Decimal
}

export interface SalesPerformance {
  orders: number
  revenue: Decimal
  kg: Decimal
  average_price: Decimal | null
  by_customer: PerformanceRow[]
  by_product: PerformanceRow[]
  /** `name` is the month, YYYY-MM, oldest first */
  by_month: PerformanceRow[]
  quotations: number
  quotation_win_pct: number | null
  returned_kg: Decimal
  returned_credit: Decimal
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
  email: string
  category: CustomerCategory | ""
  /** 0 = no limit. Going over it warns; it never blocks. */
  credit_limit: Decimal
  payment_terms_days: number
  is_active: boolean
  /** Confirmed orders less payments and return credits */
  balance: Decimal
  over_limit: boolean
}

export interface CustomerDuplicate {
  a: { id: number; name: string }
  b: { id: number; name: string }
  similarity: number
}

export interface ProcessFigures {
  sessions: number
  input_kg: number
  output_kg: number
  waste_kg: number
  efficiency_pct: number
}

export interface DailyProductionReport {
  date: string
  warehouse: { stock_entries: number; total_weight_kg: number }
  sorting: ProcessFigures
  decolorization: ProcessFigures
}

export interface MonthlySalesReport {
  year: number
  month: number
  total_orders: number
  total_revenue: number
  total_collected: number
  pending_amount: number
  total_weight_kg: number
  avg_price_per_kg: number
  total_dispatches: number
  status_breakdown: Record<string, number>
  payment_method_breakdown: Record<string, { count: number; amount: number }>
}

export interface WasteFigures {
  sessions?: number
  input_kg: number
  waste_kg: number
  waste_pct: number
}

export interface WasteReport {
  start: string
  end: string
  sorting: WasteFigures
  decolorization: WasteFigures
  total: WasteFigures
  by_fabric: { fabric: string; input_kg: number; output_kg: number; waste_kg: number; waste_pct: number }[]
}

export interface AuditEntry {
  id: number
  username: string
  user_role: string
  action: string
  model_name: string
  object_id: string
  object_repr: string
  changes: Record<string, { old: unknown; new: unknown } | unknown>
  ip_address: string | null
  endpoint: string
  timestamp: string
  timestamp_display: string
}

export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface AuditSummary {
  total_logs: number
  today: number
  this_week: number
  this_month: number
  by_action: { action: string; count: number }[]
  by_model: { model_name: string; count: number }[]
}

/** DRF validation errors: {"field": ["message"]} or {"detail": "message"}. */
export type ApiErrorBody = Record<string, string[] | string> | { detail: string }

/** Sellable dried stock per fabric lot (inventory ledger). */
export interface LotStock {
  fabric: number
  material_type: string
  on_hand_kg: string
  reserved_kg: string
  available_kg: string
}

// ── Procurement ─────────────────────────────────────────────────────────────

export type RequisitionStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Ordered" | "Cancelled"
export type PurchaseOrderStatus = "Draft" | "Submitted" | "Approved" | "Partially Received" | "Received" | "Closed" | "Cancelled"
export type SupplierCategory = "Textile waste" | "Post-consumer" | "Pre-consumer" | "Chemicals" | "Packaging" | "Other"

export interface RequisitionLine {
  id?: number
  material: string
  quantity_kg: Decimal
  notes: string
}

export interface Requisition {
  id: number
  number: string
  requested_by: number
  requested_by_name: string
  unit: number | null
  unit_name: string | null
  needed_by: string | null
  status: RequisitionStatus
  notes: string
  decided_by: number | null
  decided_by_name: string | null
  decided_at: string | null
  rejection_reason: string
  created_at: string
  lines: RequisitionLine[]
  total_kg: Decimal
  order_numbers: string[]
}

export interface PurchaseOrderLine {
  id?: number
  material: string
  quantity_kg: Decimal
  unit_price: Decimal
  amount: Decimal
  received_kg: Decimal
  rejected_kg: Decimal
  returned_kg: Decimal
  remaining_kg: Decimal
}

export interface PurchaseOrder {
  id: number
  number: string
  vendor: number
  vendor_name: string
  requisition: number | null
  requisition_number: string | null
  order_date: string
  expected_date: string | null
  status: PurchaseOrderStatus
  revision: number
  notes: string
  created_by: number
  created_by_name: string
  approved_by: number | null
  approved_by_name: string | null
  approved_at: string | null
  created_at: string
  lines: PurchaseOrderLine[]
  total_amount: Decimal
  ordered_kg: Decimal
  received_kg: Decimal
  invoiced_amount: Decimal
}

export interface OpenPoLine {
  id: number
  order: number
  order_number: string
  vendor: number
  material: string
  quantity_kg: Decimal
  unit_price: Decimal
  remaining_kg: Decimal
  expected_date: string | null
}

export interface PurchaseReturn {
  id: number
  number: string
  receipt: number
  receipt_label: string
  vendor_name: string
  order_number: string | null
  quantity_kg: Decimal
  reason: string
  return_date: string
  created_by: number
  created_by_name: string
  created_at: string
}

export interface SupplierQuotation {
  id: number
  vendor: number
  vendor_name: string
  requisition: number | null
  requisition_number: string | null
  material: string
  price_per_kg: Decimal
  min_quantity_kg: Decimal | null
  quoted_on: string
  valid_until: string | null
  notes: string
  created_at: string
}

export interface SupplierInvoice {
  id: number
  vendor: number
  vendor_name: string
  purchase_order: number | null
  order_number: string | null
  invoice_number: string
  invoice_date: string
  due_date: string | null
  amount: Decimal
  tax_amount: Decimal
  total: Decimal
  status: "Unpaid" | "Partial" | "Paid"
  paid_amount: Decimal
  outstanding: Decimal
  is_overdue: boolean
  notes: string
  created_at: string
}

export interface SupplierPayment {
  id: number
  invoice: number
  invoice_number: string
  vendor_name: string
  amount: Decimal
  method: PaymentMethod
  payment_date: string
  reference: string
  paid_by: number
  paid_by_name: string
  created_at: string
}

export interface ProcurementSummary {
  pending_requisitions: number
  pending_orders: number
  open_orders: number
  open_order_value: Decimal
  late_orders: number
  spend_this_month: Decimal
  payables: Decimal
  overdue_payables: Decimal
  overdue_invoices: number
}

export interface SupplierPerformance {
  vendor: number
  name: string
  category: SupplierCategory | ""
  is_active: boolean
  orders: number
  ordered_kg: Decimal
  received_kg: Decimal
  rejected_kg: Decimal
  spend: Decimal
  deliveries: number
  payable: Decimal
  rejected_pct: number | null
  on_time_pct: number | null
  avg_price_per_kg: Decimal | null
  inspections: number
  failed_inspections: number
  quality_pass_pct: number | null
}

export interface PriceComparison {
  material: string
  offers: {
    vendor: string
    best_quote: Decimal | null
    last_order_price: Decimal | null
    avg_order_price: Decimal | null
    orders: number
  }[]
}

// ─── Quality control ────────────────────────────────────────────────────────

export type QualityStage = "Incoming" | "In-process" | "Finished"
export type CheckKind = "Measure" | "Pass/Fail"
export type InspectionOutcome = "Pass" | "Conditional" | "Fail"

export interface StandardCheck {
  id: number
  name: string
  kind: CheckKind
  unit: string
  min_value: Decimal | null
  max_value: Decimal | null
}

export interface QualityStandard {
  id: number
  name: string
  stage: QualityStage
  /** Empty = any material */
  material_type: string
  is_active: boolean
  notes: string
  created_at: string
  checks: StandardCheck[]
  inspections: number
}

export interface InspectionCheck extends StandardCheck {
  value: Decimal | null
  passed: boolean
  note: string
}

export interface CorrectiveAction {
  id: number
  inspection: number
  inspection_number: string
  kind: "Corrective" | "Preventive"
  description: string
  owner: number | null
  owner_name: string | null
  due_date: string | null
  status: "Open" | "Done"
  completed_at: string | null
  completion_note: string
  created_by: number
  created_by_name: string
  created_at: string
  overdue: boolean
}

export interface Inspection {
  id: number
  number: string
  stage: QualityStage
  /** The delivery (incoming inspections) */
  stock: number | null
  /** The fabric lot (in-process and finished inspections) */
  fabric: number | null
  target: string
  material: string
  vendor_name: string
  standard: number | null
  standard_name: string | null
  inspector: number
  inspector_name: string
  inspected_on: string
  sample_kg: Decimal | null
  composition: string
  result: InspectionOutcome
  rejection_reason: string
  notes: string
  /** Failed and not yet released by an admin */
  quarantined: boolean
  released_by: number | null
  released_by_name: string | null
  released_at: string | null
  release_note: string
  created_at: string
  results: InspectionCheck[]
  failed_checks: number
  actions: CorrectiveAction[]
}

export interface QualitySummary {
  inspections_this_month: number
  pass_pct_this_month: number | null
  conditional_this_month: number
  failed_this_month: number
  quarantined: number
  open_actions: number
  overdue_actions: number
  trend: { month: string; Pass: number; Conditional: number; Fail: number }[]
  stages: { stage: QualityStage; Pass: number; Conditional: number; Fail: number }[]
  defects: { name: string; checks: number; failures: number; failure_pct: number }[]
  suppliers: { vendor: number; name: string; inspections: number; failed: number; pass_pct: number }[]
}

// ─── Production ─────────────────────────────────────────────────────────────

export type StageModule = "" | "sorting" | "decolorization" | "drying"

export interface ProcessStage {
  id: number
  name: string
  sequence: number
  /** The module whose sessions do this work, if any */
  module: StageModule
  is_active: boolean
}

export interface RoutingStep {
  id: number
  stage: number
  stage_name: string
  sequence: number
  planned_hours: Decimal
  hourly_cost: Decimal
}

export interface Routing {
  id: number
  name: string
  description: string
  is_active: boolean
  created_at: string
  steps: RoutingStep[]
  orders: number
  planned_hours: Decimal
}

export interface BomLine {
  id: number
  material: string
  chemical: number | null
  chemical_name: string | null
  quantity_per_100kg: Decimal
  unit: string
  unit_cost: Decimal
}

export interface Bom {
  id: number
  name: string
  product_name: string
  is_active: boolean
  notes: string
  created_at: string
  lines: BomLine[]
  orders: number
}

export type StepStatus = "Pending" | "In Progress" | "Done" | "Skipped"

export interface OrderStep {
  id: number
  order: number
  order_number: string
  stage: number
  stage_name: string
  stage_module: StageModule
  sequence: number
  status: StepStatus
  operator: number | null
  operator_name: string | null
  machine: string
  planned_hours: Decimal
  hourly_cost: Decimal
  started_at: string | null
  finished_at: string | null
  actual_hours: Decimal | null
  input_kg: Decimal | null
  output_kg: Decimal | null
  waste_kg: Decimal | null
  notes: string
  cost: Decimal
}

export interface MaterialUse {
  id: number
  order: number
  material: string
  chemical: number | null
  chemical_name: string | null
  unit: string
  planned_quantity: Decimal
  actual_quantity: Decimal | null
  unit_cost: Decimal
  planned_cost: Decimal
  actual_cost: Decimal | null
}

export type ProductionStatus = "Draft" | "Released" | "In Progress" | "Completed" | "Cancelled"
export type Priority = "Low" | "Normal" | "High"

export interface ProductionOrder {
  id: number
  number: string
  product_name: string
  fabric: number
  fabric_material: string
  unit: number | null
  unit_name: string | null
  routing: number
  routing_name: string
  bom: number | null
  bom_name: string | null
  planned_input_kg: Decimal
  planned_output_kg: Decimal
  planned_start: string
  planned_end: string
  priority: Priority
  status: ProductionStatus
  actual_output_kg: Decimal | null
  notes: string
  created_by: number
  created_by_name: string
  released_by: number | null
  released_by_name: string | null
  released_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  steps: OrderStep[]
  materials: MaterialUse[]
  // Planned against actual (computed by the server)
  progress_pct: number
  current_stage: string | null
  planned_hours: Decimal
  actual_hours: Decimal
  actual_input_kg: Decimal | null
  output_kg: Decimal | null
  waste_kg: Decimal
  yield_pct: number | null
  planned_cost: Decimal
  labour_cost: Decimal
  material_cost: Decimal
  total_cost: Decimal
  cost_per_kg: Decimal | null
  is_late: boolean
}

export interface ProductionSummary {
  draft: number
  released: number
  in_progress: number
  completed: number
  late: number
  wip_kg: Decimal
  completed_this_month: number
  output_this_month: Decimal
  planned_output_completed: Decimal
  actual_output_completed: Decimal
  yield_pct: number | null
  waste_kg: Decimal
  planned_cost_completed: Decimal
  actual_cost_completed: Decimal
  cost_per_kg: Decimal | null
  stages: { stage: string; steps: number; planned_hours: Decimal; actual_hours: Decimal; input_kg: Decimal; output_kg: Decimal; waste_kg: Decimal }[]
}

export interface MaterialRequirement {
  material: string
  chemical: number | null
  unit: string
  required: Decimal
  /** Chemical stock on hand; null for materials that are not stocked chemicals */
  in_stock: Decimal | null
  shortage: Decimal | null
  orders: string[]
}

export interface LotActivity {
  module: "sorting" | "decolorization" | "drying"
  id: number
  status: string
  supervisor: string
  input_kg: Decimal
  output_kg: Decimal
  waste_kg: Decimal
  date: string
}
