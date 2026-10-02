// API types for the Sustainability module.
import type { Decimal } from "./api"

export type WasteClassification = "Recyclable" | "Reusable" | "Hazardous" | "General"
export type WasteStage = "Warehouse" | "Sorting" | "Decolorization" | "Drying" | "Other"
export type DisposalMethod =
  | "Recycled internally" | "Sold as by-product" | "Sent to recycler" | "Reused" | "Landfill" | "Incinerated" | "Treated"
export type Utility = "Water" | "Electricity" | "Gas" | "Steam" | "Diesel"
export type TargetMetric = "recovery_rate" | "landfill_share" | "water_per_kg" | "energy_per_kg" | "chemical_per_kg"
export type TargetDirection = "At least" | "At most"

export interface WasteCategory {
  id: number
  name: string
  classification: WasteClassification
  description: string
  is_active: boolean
  /** Number of waste records that use it */
  records: number
  created_at: string
}

export interface WasteRecord {
  id: number
  date: string
  category: number
  category_name: string
  classification: WasteClassification
  stage: WasteStage
  quantity_kg: Decimal
  fabric: number | null
  fabric_material: string | null
  disposal_method: DisposalMethod
  disposed_to: string
  disposal_cost: Decimal
  revenue: Decimal
  disposal_reference: string
  notes: string
  recorded_by: number
  recorded_by_name: string
  created_at: string
}

export interface UtilityReading {
  id: number
  date: string
  utility: Utility
  quantity: Decimal
  /** Set by the server: each utility has one unit */
  unit: string
  cost: Decimal
  stage: WasteStage | ""
  meter_reference: string
  notes: string
  recorded_by: number
  recorded_by_name: string
  created_at: string
}

export interface SustainabilityTarget {
  id: number
  metric: TargetMetric
  metric_label: string
  target_value: Decimal
  direction: TargetDirection
  period: string
  is_active: boolean
  created_at: string
}

export interface StageBalance {
  stage: "Sorting" | "Decolorization" | "Drying"
  sessions: number
  input_kg: Decimal
  output_kg: Decimal
  loss_kg: Decimal
  loss_pct: Decimal | null
  /** Waste weight entered on the sessions */
  waste_kg: Decimal
  other_loss_kg: Decimal
  yield_pct: Decimal | null
}

export interface WasteShare {
  name: string
  kg: Decimal
  share_pct: Decimal | null
}

export interface TargetResult {
  id: number
  metric: TargetMetric
  metric_label: string
  direction: TargetDirection
  target_value: Decimal
  period: string
  actual: Decimal | null
  /** null when there is nothing to measure in the period */
  met: boolean | null
}

/** Calculated figures for one period (the report; the summary adds the trend). */
export interface SustainabilityReport {
  material_in: { deliveries: number; kg: Decimal }
  stages: StageBalance[]
  recovery: {
    input_kg: Decimal
    output_kg: Decimal
    rate_pct: Decimal | null
    loss_kg: Decimal | null
    stage_yield_pct: Decimal | null
  }
  waste: {
    records: number
    total_kg: Decimal
    landfill_kg: Decimal
    diverted_kg: Decimal
    diverted_pct: Decimal | null
    landfill_pct: Decimal | null
    hazardous_kg: Decimal
    disposal_cost: Decimal
    revenue: Decimal
    by_classification: WasteShare[]
    by_method: WasteShare[]
    by_stage: WasteShare[]
    by_category: WasteShare[]
  }
  utilities: {
    water_m3: Decimal
    water_l_per_kg: Decimal | null
    session_water_liters: Decimal
    energy_kwh: Decimal
    energy_kwh_per_kg: Decimal | null
    total_cost: Decimal
    by_utility: { utility: Utility; unit: string; quantity: Decimal; cost: Decimal; readings: number }[]
  }
  chemicals: {
    issuances: number
    total_cost: Decimal
    cost_per_kg: Decimal | null
    items: { chemical: number; chemical_name: string; unit: string; quantity: Decimal; cost: Decimal; issuances: number }[]
  }
  targets: TargetResult[]
  definitions: { name: string; text: string }[]
}

export interface TrendMonth {
  /** YYYY-MM */
  month: string
  input_kg: Decimal
  output_kg: Decimal
  recovery_pct: Decimal | null
  waste_kg: Decimal
  water_m3: Decimal
  energy_kwh: Decimal
}

export interface SustainabilitySummary extends SustainabilityReport {
  trend: TrendMonth[]
}
