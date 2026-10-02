import { z } from "zod"

import { decimalString, requiredId } from "@/lib/forms"

export const ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Income", "Expense"] as const
export const COST_CENTRES = ["General", "Warehouse", "Sorting", "Decolorization", "Drying", "Maintenance", "Sales"] as const
export const ENTRY_SOURCES = [
  "Manual", "Expense", "Sales invoice", "Customer payment", "Sales return", "Supplier invoice", "Supplier payment",
] as const
const YES_NO = ["yes", "no"] as const

const optionalAmount = z.string().trim().refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Enter a number with up to 2 decimals.")

export const accountSchema = z.object({
  code: z.string().trim().min(1, "Enter the account code.").max(20),
  name: z.string().trim().min(1, "Enter the account name.").max(150),
  type: z.enum(ACCOUNT_TYPES),
  is_cash: z.enum(YES_NO),
  is_active: z.enum(YES_NO),
  description: z.string().trim(),
}).refine((v) => v.is_cash === "no" || v.type === "Asset", { path: ["is_cash"], message: "Only an asset account can be a cash or bank account." })
export type AccountForm = z.infer<typeof accountSchema>

const entryLine = z.object({
  account: requiredId("an account"),
  debit: optionalAmount,
  credit: optionalAmount,
  description: z.string().trim().max(255),
}).refine((l) => (Number(l.debit) > 0) !== (Number(l.credit) > 0), { path: ["debit"], message: "Enter a debit or a credit, not both." })

/** Debit and credit totals of the lines typed so far. */
export function lineTotals(lines: { debit: string; credit: string }[]) {
  const sum = (key: "debit" | "credit") => Math.round(lines.reduce((a, l) => a + (Number(l[key]) || 0), 0) * 100) / 100
  return { debit: sum("debit"), credit: sum("credit") }
}

export const entrySchema = z.object({
  date: z.string().min(1, "Enter the date."),
  memo: z.string().trim().min(1, "Say what the entry is for.").max(255),
  reference: z.string().trim().max(100),
  lines: z.array(entryLine).min(2, "An entry needs at least two lines.")
    .refine((lines) => { const t = lineTotals(lines); return t.debit === t.credit }, "Debits and credits must be equal."),
})
export type EntryForm = z.infer<typeof entrySchema>

export const expenseSchema = z.object({
  date: z.string().min(1, "Enter the date."),
  account: requiredId("an expense account"),
  paid_from: requiredId("the account it was paid from"),
  amount: decimalString("the amount"),
  payee: z.string().trim().max(150),
  description: z.string().trim().min(1, "Say what was paid for.").max(255),
  cost_centre: z.enum(COST_CENTRES),
  reference: z.string().trim().max(100),
})
export type ExpenseForm = z.infer<typeof expenseSchema>

export const periodSchema = z.object({
  name: z.string().trim().min(1, "Enter a name, e.g. October 2026.").max(50),
  start_date: z.string().min(1, "Enter the start date."),
  end_date: z.string().min(1, "Enter the end date."),
}).refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, { path: ["end_date"], message: "Can't be before the start date." })
export type PeriodForm = z.infer<typeof periodSchema>

export const taxRateSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
  rate: z.string().trim().refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 100, "Enter a percentage from 0 to 100."),
  is_active: z.enum(YES_NO),
})
export type TaxRateForm = z.infer<typeof taxRateSchema>
