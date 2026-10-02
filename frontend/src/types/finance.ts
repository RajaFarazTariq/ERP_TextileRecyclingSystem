// API types for the Finance module.
import type { Decimal } from "./api"

export type AccountType = "Asset" | "Liability" | "Equity" | "Income" | "Expense"

export interface Account {
  id: number
  code: string
  name: string
  type: AccountType
  /** A cash or bank account */
  is_cash: boolean
  description: string
  is_active: boolean
  /** On the account's natural side: assets and expenses are debit balances */
  balance: Decimal
  /** Used by the automatic postings; can be renamed but not deleted */
  is_system: boolean
}

export interface FinancialPeriod {
  id: number
  name: string
  start_date: string
  end_date: string
  is_closed: boolean
  closed_by: number | null
  closed_by_name: string | null
  closed_at: string | null
}

export interface TaxRate {
  id: number
  name: string
  rate: Decimal
  is_active: boolean
}

export type EntrySource =
  | "Manual" | "Expense" | "Sales invoice" | "Customer payment" | "Sales return" | "Supplier invoice" | "Supplier payment"

export interface JournalLine {
  id: number
  account: number
  account_code: string
  account_name: string
  debit: Decimal
  credit: Decimal
  description: string
}

export interface JournalEntry {
  id: number
  number: string
  date: string
  memo: string
  source: EntrySource
  source_id: number | null
  reference: string
  reverses: number | null
  reverses_number: string | null
  reversed_by_number: string | null
  created_by: number | null
  created_by_name: string | null
  created_at: string
  lines: JournalLine[]
  total: Decimal
}

export type CostCentre = "General" | "Warehouse" | "Sorting" | "Decolorization" | "Drying" | "Maintenance" | "Sales"

export interface Expense {
  id: number
  number: string
  date: string
  account: number
  account_name: string
  paid_from: number
  paid_from_name: string
  amount: Decimal
  payee: string
  description: string
  cost_centre: CostCentre
  reference: string
  created_by: number
  created_by_name: string
  created_at: string
}

export interface StatementRow {
  account: number
  code: string
  name: string
  type: AccountType
  amount: Decimal
}

export interface TrialBalance {
  as_of: string
  rows: { account: number; code: string; name: string; type: AccountType; debit: Decimal; credit: Decimal }[]
  debit: Decimal
  credit: Decimal
  balanced: boolean
}

export interface ProfitAndLoss {
  start: string
  end: string
  income: StatementRow[]
  expenses: StatementRow[]
  total_income: Decimal
  total_expenses: Decimal
  net_profit: Decimal
}

export interface BalanceSheet {
  as_of: string
  assets: StatementRow[]
  liabilities: StatementRow[]
  equity: StatementRow[]
  /** Profit kept in the business: income less expenses to date */
  retained_earnings: Decimal
  total_assets: Decimal
  total_liabilities: Decimal
  total_equity: Decimal
  balanced: boolean
}

export interface CashFlow {
  start: string
  end: string
  opening: Decimal
  rows: { source: EntrySource; inflow: Decimal; outflow: Decimal }[]
  inflow: Decimal
  outflow: Decimal
  net: Decimal
  closing: Decimal
}

export interface AccountLedger {
  account: number
  code: string
  name: string
  type: AccountType
  opening: Decimal
  closing: Decimal
  rows: { date: string; entry: number; number: string; memo: string; source: EntrySource; debit: Decimal; credit: Decimal; balance: Decimal }[]
}

export interface Balances {
  receivables: { customer: number; name: string; balance: Decimal; credit_limit: Decimal; over_limit: boolean }[]
  payables: { supplier: number; name: string; balance: Decimal; overdue: Decimal }[]
  total_receivable: Decimal
  total_payable: Decimal
}

export interface Costing {
  start: string
  end: string
  rows: { kind: string; basis: string; amount: Decimal; share_pct: number | null }[]
  total: Decimal
  output_kg: Decimal
  cost_per_kg: Decimal | null
  by_cost_centre: { cost_centre: CostCentre; amount: Decimal }[]
  orders: number
  estimated_order_cost: Decimal
  actual_order_cost: Decimal
  order_variance: Decimal
}

export interface FinanceSummary {
  cash: { account: number; name: string; balance: Decimal }[]
  cash_total: Decimal
  receivable: Decimal
  payable: Decimal
  income_month: Decimal
  expenses_month: Decimal
  profit_month: Decimal
  income_year: Decimal
  expenses_year: Decimal
  profit_year: Decimal
  trend: { month: string; income: Decimal; expenses: Decimal; profit: Decimal }[]
  top_expenses: StatementRow[]
  open_period: boolean
}

export interface SyncResult {
  posted: number
  updated: number
  removed: number
  skipped_closed: number
}
