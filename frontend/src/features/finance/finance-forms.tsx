"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"

import { Field, FieldGroup, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { today } from "@/features/procurement/schemas"
import { useSave } from "@/lib/crud"
import { rupees } from "@/lib/format"
import { applyServerErrors } from "@/lib/forms"
import { cn } from "@/lib/utils"
import type { Account, Expense, FinancialPeriod, JournalEntry, TaxRate } from "@/types/finance"
import {
  ACCOUNT_TYPES, type AccountForm, COST_CENTRES, type EntryForm, type ExpenseForm, type PeriodForm, type TaxRateForm,
  accountSchema, entrySchema, expenseSchema, lineTotals, periodSchema, taxRateSchema,
} from "./schemas"

// Everything that shows money figures; refreshed after any change
export const FINANCE_LISTS = [
  ["finance/accounts"], ["finance/journal"], ["finance/expenses"], ["finance/summary"], ["finance/periods"],
  ["finance/trial-balance"], ["finance/profit-and-loss"], ["finance/balance-sheet"], ["finance/cash-flow"],
  ["finance/costing"], ["finance/balances"],
]

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

const accountLabel = (a: Account) => `${a.code} ${a.name}`
const YES_NO = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]

// ─── Account ────────────────────────────────────────────────────────────────

export function AccountDialog(props: DialogProps<Account>) {
  return props.open ? <AccountDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function AccountDialogBody({ open, onOpenChange, record }: DialogProps<Account>) {
  const save = useSave<Account>("finance/accounts", { noun: "Account", invalidate: FINANCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: record?.code ?? "", name: record?.name ?? "", type: record?.type ?? "Expense",
      is_cash: record?.is_cash ? "yes" : "no", is_active: record && !record.is_active ? "no" : "yes",
      description: record?.description ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, is_cash: values.is_cash === "yes", is_active: values.is_active === "yes" } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New account"}
      description={record?.is_system ? "Automatic postings use this account. It can be renamed but not deleted or switched off." : undefined}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Field id="account-code" label="Code" error={errors.code?.message}>
          <Input id="account-code" placeholder="e.g. 5330" aria-invalid={!!errors.code} {...form.register("code")} />
        </Field>
        <Field id="account-name" label="Name" error={errors.name?.message}>
          <Input id="account-name" placeholder="e.g. Diesel for generator" aria-invalid={!!errors.name} {...form.register("name")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="account-type" label="Type" error={errors.type?.message}>
          <Controller control={form.control} name="type" render={({ field }) => (
            <SelectField id="account-type" value={field.value} onChange={field.onChange} placeholder="Type"
              options={ACCOUNT_TYPES.map((t) => ({ value: t, label: t }))} />
          )} />
        </Field>
        <Field id="account-cash" label="Cash or bank" error={errors.is_cash?.message}>
          <Controller control={form.control} name="is_cash" render={({ field }) => (
            <SelectField id="account-cash" value={field.value} onChange={field.onChange} placeholder="Select" options={YES_NO} />
          )} />
        </Field>
        <Field id="account-active" label="In use" error={errors.is_active?.message}>
          <Controller control={form.control} name="is_active" render={({ field }) => (
            <SelectField id="account-active" value={field.value} onChange={field.onChange} placeholder="Select" options={YES_NO} />
          )} />
        </Field>
      </div>
      <Field id="account-description" label="Description">
        <Textarea id="account-description" rows={2} {...form.register("description")} />
      </Field>
    </FormDialog>
  )
}

// ─── Journal entry ──────────────────────────────────────────────────────────

type EntryDialogProps = DialogProps<JournalEntry> & { accounts: Account[] }

export function EntryDialog(props: EntryDialogProps) {
  return props.open ? <EntryDialogBody {...props} /> : null
}

const BLANK_LINE = { account: "", debit: "", credit: "", description: "" }

function EntryDialogBody({ open, onOpenChange, accounts }: EntryDialogProps) {
  const save = useSave<JournalEntry>("finance/journal", { noun: "Journal entry", invalidate: FINANCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<EntryForm>({
    resolver: zodResolver(entrySchema),
    defaultValues: { date: today(), memo: "", reference: "", lines: [BLANK_LINE, BLANK_LINE] },
  })
  const lines = useFieldArray({ control: form.control, name: "lines" })
  const { errors, isSubmitting } = form.formState
  const totals = lineTotals(useWatch({ control: form.control, name: "lines" }))
  const difference = Math.round((totals.debit - totals.credit) * 100) / 100
  const usable = accounts.filter((a) => a.is_active)

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        body: {
          ...values,
          lines: values.lines.map((l) => ({ account: Number(l.account), debit: l.debit || "0", credit: l.credit || "0", description: l.description })),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="New journal entry"
      description="Debits and credits must be equal. An entry can't be edited later; a wrong one is reversed."
      error={formError} submitting={isSubmitting} submitLabel="Post entry" onSubmit={onSubmit} className="sm:max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="entry-date" label="Date" error={errors.date?.message}>
          <Input id="entry-date" type="date" aria-invalid={!!errors.date} {...form.register("date")} />
        </Field>
        <Field id="entry-reference" label="Reference" hint="Optional">
          <Input id="entry-reference" {...form.register("reference")} />
        </Field>
      </div>
      <Field id="entry-memo" label="What it is for" error={errors.memo?.message}>
        <Input id="entry-memo" placeholder="e.g. Owner put money into the business" aria-invalid={!!errors.memo} {...form.register("memo")} />
      </Field>
      <FieldGroup title="Lines">
        <div className="hidden grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_auto] gap-2 px-0.5 text-xs text-muted-foreground sm:grid">
          <span>Account</span><span>Debit</span><span>Credit</span><span className="w-9" />
        </div>
        {lines.fields.map((line, i) => {
          const message = errors.lines?.[i]?.account?.message ?? errors.lines?.[i]?.debit?.message ?? errors.lines?.[i]?.credit?.message
          return (
            <div key={line.id} className="space-y-1">
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))_auto] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_auto]">
                <Controller control={form.control} name={`lines.${i}.account`} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="col-span-full w-full sm:col-span-1" aria-label={`Account ${i + 1}`} aria-invalid={!!errors.lines?.[i]?.account}>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>{usable.map((a) => <SelectItem key={a.id} value={String(a.id)}>{accountLabel(a)}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
                <Input aria-label={`Debit ${i + 1}`} placeholder="Debit" inputMode="decimal" aria-invalid={!!errors.lines?.[i]?.debit}
                  {...form.register(`lines.${i}.debit`)} />
                <Input aria-label={`Credit ${i + 1}`} placeholder="Credit" inputMode="decimal" aria-invalid={!!errors.lines?.[i]?.credit}
                  {...form.register(`lines.${i}.credit`)} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove line ${i + 1}`}
                  disabled={lines.fields.length <= 2} onClick={() => lines.remove(i)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {message && <p className="text-[13px] text-destructive">{message}</p>}
            </div>
          )
        })}
        <Button type="button" variant="outline" className="w-fit" onClick={() => lines.append(BLANK_LINE)}>
          <Plus className="size-4" /> Add line
        </Button>
        <p className={cn("rounded-md px-3 py-2 text-sm tabular-nums", difference === 0 && totals.debit > 0 ? "bg-success/12 text-success-fg" : "bg-muted")}>
          Debits {rupees(totals.debit)} · Credits {rupees(totals.credit)}
          {difference !== 0 && <> · Out by {rupees(Math.abs(difference))}</>}
          {difference === 0 && totals.debit > 0 && <> · Balanced</>}
        </p>
        {(errors.lines?.root?.message ?? errors.lines?.message) && (
          <p className="text-[13px] text-destructive">{errors.lines?.root?.message ?? errors.lines?.message}</p>
        )}
      </FieldGroup>
    </FormDialog>
  )
}

// ─── Expense ────────────────────────────────────────────────────────────────

type ExpenseDialogProps = DialogProps<Expense> & { accounts: Account[] }

export function ExpenseDialog(props: ExpenseDialogProps) {
  return props.open ? <ExpenseDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function ExpenseDialogBody({ open, onOpenChange, record, accounts }: ExpenseDialogProps) {
  const save = useSave<Expense>("finance/expenses", { noun: "Expense", invalidate: FINANCE_LISTS })
  const [formError, setFormError] = useState("")
  const cashAccounts = accounts.filter((a) => a.is_cash && (a.is_active || a.id === record?.paid_from))
  const form = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: record?.date ?? today(),
      account: record ? String(record.account) : "",
      paid_from: record ? String(record.paid_from) : cashAccounts.length === 1 ? String(cashAccounts[0].id) : "",
      amount: record?.amount ?? "",
      payee: record?.payee ?? "",
      description: record?.description ?? "",
      cost_centre: record?.cost_centre ?? "General",
      reference: record?.reference ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, account: Number(values.account), paid_from: Number(values.paid_from) } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.number}` : "Record expense"}
      description="Money paid out that is not a supplier invoice. The journal entry is made for you."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="expense-date" label="Date" error={errors.date?.message}>
          <Input id="expense-date" type="date" aria-invalid={!!errors.date} {...form.register("date")} />
        </Field>
        <Field id="expense-amount" label="Amount (Rs.)" error={errors.amount?.message}>
          <Input id="expense-amount" inputMode="decimal" aria-invalid={!!errors.amount} {...form.register("amount")} />
        </Field>
      </div>
      <Field id="expense-description" label="What was paid for" error={errors.description?.message}>
        <Input id="expense-description" placeholder="e.g. Electricity bill for September" aria-invalid={!!errors.description} {...form.register("description")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="expense-account" label="Expense account" error={errors.account?.message}>
          <Controller control={form.control} name="account" render={({ field }) => (
            <SelectField id="expense-account" value={field.value} onChange={field.onChange} invalid={!!errors.account} placeholder="Select account"
              options={accounts.filter((a) => a.type === "Expense" && (a.is_active || a.id === record?.account)).map((a) => ({ value: String(a.id), label: accountLabel(a) }))} />
          )} />
        </Field>
        <Field id="expense-paid-from" label="Paid from" error={errors.paid_from?.message}>
          <Controller control={form.control} name="paid_from" render={({ field }) => (
            <SelectField id="expense-paid-from" value={field.value} onChange={field.onChange} invalid={!!errors.paid_from} placeholder="Cash or bank"
              options={cashAccounts.map((a) => ({ value: String(a.id), label: a.name }))} />
          )} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="expense-centre" label="Part of the factory" hint="Used in production costing">
          <Controller control={form.control} name="cost_centre" render={({ field }) => (
            <SelectField id="expense-centre" value={field.value} onChange={field.onChange} placeholder="Select"
              options={COST_CENTRES.map((c) => ({ value: c, label: c }))} />
          )} />
        </Field>
        <Field id="expense-payee" label="Paid to" error={errors.payee?.message}>
          <Input id="expense-payee" {...form.register("payee")} />
        </Field>
      </div>
      <Field id="expense-reference" label="Voucher or receipt number" hint="Optional">
        <Input id="expense-reference" {...form.register("reference")} />
      </Field>
    </FormDialog>
  )
}

// ─── Period and tax rate ────────────────────────────────────────────────────

export function PeriodDialog(props: DialogProps<FinancialPeriod>) {
  return props.open ? <PeriodDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function PeriodDialogBody({ open, onOpenChange, record }: DialogProps<FinancialPeriod>) {
  const save = useSave<FinancialPeriod>("finance/periods", { noun: "Period", invalidate: FINANCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<PeriodForm>({
    resolver: zodResolver(periodSchema),
    defaultValues: { name: record?.name ?? "", start_date: record?.start_date ?? "", end_date: record?.end_date ?? "" },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: values })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New period"}
      description="Closing a period locks every entry dated inside it."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="period-name" label="Name" error={errors.name?.message}>
        <Input id="period-name" placeholder="e.g. October 2026" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="period-start" label="From" error={errors.start_date?.message}>
          <Input id="period-start" type="date" aria-invalid={!!errors.start_date} {...form.register("start_date")} />
        </Field>
        <Field id="period-end" label="To" error={errors.end_date?.message}>
          <Input id="period-end" type="date" aria-invalid={!!errors.end_date} {...form.register("end_date")} />
        </Field>
      </div>
    </FormDialog>
  )
}

export function TaxRateDialog(props: DialogProps<TaxRate>) {
  return props.open ? <TaxRateDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function TaxRateDialogBody({ open, onOpenChange, record }: DialogProps<TaxRate>) {
  const save = useSave<TaxRate>("finance/tax-rates", { noun: "Tax rate" })
  const [formError, setFormError] = useState("")
  const form = useForm<TaxRateForm>({
    resolver: zodResolver(taxRateSchema),
    defaultValues: { name: record?.name ?? "", rate: record?.rate ?? "", is_active: record && !record.is_active ? "no" : "yes" },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, is_active: values.is_active === "yes" } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New tax rate"}
      description="A list of the rates you use, for reference when entering the tax % on orders and invoices."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="tax-name" label="Name" error={errors.name?.message}>
        <Input id="tax-name" placeholder="e.g. Sales tax" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tax-rate" label="Rate, %" error={errors.rate?.message}>
          <Input id="tax-rate" inputMode="decimal" aria-invalid={!!errors.rate} {...form.register("rate")} />
        </Field>
        <Field id="tax-active" label="In use">
          <Controller control={form.control} name="is_active" render={({ field }) => (
            <SelectField id="tax-active" value={field.value} onChange={field.onChange} placeholder="Select" options={YES_NO} />
          )} />
        </Field>
      </div>
    </FormDialog>
  )
}
