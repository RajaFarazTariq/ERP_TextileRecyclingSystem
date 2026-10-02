// API types for global search and traceability.

export type SearchResultType =
  | "lots" | "deliveries" | "suppliers" | "customers" | "requisitions" | "purchase_orders" | "sales_orders"
  | "quotations" | "invoices" | "returns" | "production_orders" | "inspections" | "chemicals" | "machines"
  | "work_orders" | "employees" | "documents"

export interface SearchResult {
  type: SearchResultType
  id: number
  label: string
  detail: string
  /** The page that shows the record */
  href: string
  /** The fabric lot the record leads to, if any */
  lot: number | null
}

export interface SearchGroup {
  type: SearchResultType
  label: string
  results: SearchResult[]
}

export interface SearchResponse {
  query: string
  groups: SearchGroup[]
  total: number
}

/** A section the signed-in role may not read */
export interface Restricted {
  restricted: true
}

export interface TraceAction {
  id: number
  kind: string
  description: string
  owner: string | null
  due_date: string | null
  status: string
}

export interface TraceInspection {
  id: number
  number: string
  stage: string
  inspected_on: string
  inspector: string | null
  result: string
  quarantined: boolean
  composition: string
  rejection_reason: string
  released_at: string | null
  released_by: string | null
  release_note: string
  actions: TraceAction[]
}

export interface TracePurchaseOrder {
  id: number
  number: string
  status: string
  order_date: string
  material: string
  quantity_kg: string
  unit_price: string
}

export interface TraceSource {
  delivery: {
    id: number
    supplier: string
    supplier_id: number
    received_at: string
    fabric_type: string
    vendor_weight_slip: string
    vehicle_no: string
    our_weight: string
    unloading_weight: string
    unit: string
    status: string
  }
  purchase_order: TracePurchaseOrder | Restricted | null
  inspections: TraceInspection[] | Restricted
}

export interface TraceLot {
  id: number
  material_type: string
  initial_quantity: string
  sorted_quantity: string
  remaining_quantity: string
  status: string
  quarantined: boolean
  quarantined_by: string | null
  created_at: string
}

export interface TraceSorting {
  sessions: {
    id: number
    unit: string
    supervisor: string | null
    status: string
    start_date: string
    end_date: string | null
    quantity_taken: string
    quantity_sorted: string
    waste_quantity: string
  }[]
  taken: string
  sorted: string
  waste: string
}

export interface TraceChemical {
  id: number
  chemical: string
  unit: string
  quantity: string
  unit_cost: string
  cost: string
  issued_at: string
}

export interface TraceDecolorization {
  sessions: {
    id: number
    tank: string
    batch_id: string
    supervisor: string | null
    status: string
    start_date: string
    end_date: string | null
    recipe: string | null
    input_quantity: string
    output_quantity: string
    waste_quantity: string
    temperature_c: string | null
    duration_minutes: number | null
    water_liters: string | null
    approved_by: string | null
    approved_at: string | null
    chemicals: TraceChemical[]
    chemical_cost: string
  }[]
  input: string
  output: string
  waste: string
  chemical_cost: string
}

export interface TraceDrying {
  sessions: {
    id: number
    dryer: string
    supervisor: string | null
    status: string
    start_date: string | null
    end_date: string | null
    input_quantity: string
    output_quantity: string
    waste_quantity: string
    temperature_celsius: string | null
    duration_minutes: number | null
  }[]
  input: string
  output: string
  waste: string
}

export interface TraceProduction {
  orders: {
    id: number
    number: string
    product_name: string
    status: string
    priority: string
    planned_start: string
    planned_end: string
    planned_input_kg: string
    planned_output_kg: string
    input_kg: string | null
    output_kg: string | null
    waste_kg: string | null
    yield_pct: string | null
    labour_cost: string
    material_cost: string
    total_cost: string
    steps: {
      id: number
      stage: string
      status: string
      operator: string | null
      machine: string
      started_at: string | null
      finished_at: string | null
      actual_hours: string | null
      input_kg: string | null
      output_kg: string | null
      waste_kg: string | null
    }[]
  }[]
  total_cost: string
}

export interface TraceStock {
  on_hand: string
  reserved: string
  available: string
  movements: {
    id: number
    movement_type: string
    label: string
    quantity: string
    note: string
    created_by: string | null
    created_at: string
  }[]
}

export interface TraceSales {
  orders: {
    id: number
    customer: string
    customer_id: number | null
    status: string
    payment_status: string
    fabric_quality: string
    weight_sold: string
    price_per_kg: string
    total_price: string
    created_at: string
    dispatches: {
      id: number
      challan_number: string
      vehicle_number: string
      driver_name: string | null
      dispatched_weight: string
      status: string
      dispatch_date: string
      delivery_date: string | null
    }[]
    invoices: {
      id: number
      number: string
      invoice_date: string
      due_date: string
      weight: string
      total: string
      paid: string
      status: string
    }[]
    returns: {
      id: number
      number: string
      return_date: string
      weight: string
      reason: string
      restock: boolean
      status: string
      credit_amount: string
    }[]
  }[]
  sold: string
  dispatched: string
  returned: string
  revenue: string
}

export interface TraceSummary {
  weight_in: string
  sorted: string | null
  decolorized: string | null
  dried: string | null
  sold: string | null
  dispatched: string | null
  returned: string | null
  waste: { sorting: string | null; decolorization: string | null; drying: string | null; total: string | null }
  yield_pct: string | null
  chemical_cost: string | null
  production_cost: string | null
  total_cost: string | null
  generated_at: string
}

export interface Trace {
  lot_id: number
  /** Filled when the request (a delivery) led to more than one lot */
  matches: { id: number; material_type: string; status: string }[]
  source: TraceSource | Restricted
  lot: TraceLot | Restricted
  sorting: TraceSorting | Restricted
  decolorization: TraceDecolorization | Restricted
  drying: TraceDrying | Restricted
  production: TraceProduction | Restricted
  quality: { inspections: TraceInspection[] } | Restricted
  stock: TraceStock | Restricted
  sales: TraceSales | Restricted
  summary: TraceSummary
}
