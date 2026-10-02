// API types for the report centre and the executive dashboard.

export type ReportColumnKind = "text" | "number" | "kg" | "money" | "percent" | "date"
export type ReportValue = string | number | null

export interface ReportCatalogueItem {
  key: string
  title: string
  description: string
  group: string
  /** False for a report whose calculation has no period */
  dated: boolean
}

export interface ReportCatalogue {
  groups: string[]
  reports: ReportCatalogueItem[]
}

export interface ReportColumn {
  key: string
  label: string
  kind: ReportColumnKind
}

/** A row's values by column key; `_href` is the page the row's record lives on. */
export type ReportRow = Record<string, ReportValue | undefined> & { _href?: string }

export interface ReportChart {
  type: "bar" | "line"
  /** Column whose values go along the axis */
  x: string
  series: { key: string; label: string }[]
  kind: ReportColumnKind
  /** Add up rows that share the same axis value */
  group?: boolean
  /** Use only the rows where this column has this value */
  only?: { key: string; value: string }
}

export interface ReportResult {
  key: string
  title: string
  description: string
  group: string
  period: { start: string | null; end: string | null; label: string }
  generated_at: string
  columns: ReportColumn[]
  rows: ReportRow[]
  totals: Record<string, ReportValue>
  notes: string[]
  summary: { label: string; value: ReportValue; kind: ReportColumnKind }[]
  chart: ReportChart | null
}

export interface ReportSchedules {
  recipient_set: boolean
  automatic: boolean
  how: string
  reports: { name: string; command: string; suggested: string; contents: string }[]
}

/** Each block is null when that module's figures could not be worked out. */
export interface ExecutiveSummary {
  as_of: string
  finance: { cash: string; receivable: string; payable: string; profit_month: string } | null
  sales: { open_orders: number; open_order_value: string; overdue_invoices: number; overdue_amount: string } | null
  procurement: { pending_orders: number; awaiting_approval: number; awaiting_delivery: number; late_orders: number } | null
  production: { in_progress: number; late: number } | null
  quality: { quarantined: number; open_actions: number; overdue_actions: number } | null
  maintenance: { broken_down: number; overdue_schedules: number } | null
  sustainability: { recovery_pct: string | null; landfill_kg: string; waste_kg: string } | null
  documents: { expired: number; expiring_soon: number; expiring_days: number } | null
  workforce: { present_today: number; on_leave_today: number; employees: number } | null
}
