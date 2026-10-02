"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BookOpen, HandCoins, Landmark, Lock, LockOpen, Plus, RefreshCw, TrendingUp, Undo2, Wallet } from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { axisProps, ChartCard, ChartLegend, ChartTooltip, cursorProps, gridProps, yAxisProps } from "@/components/common/chart"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, dateParams, periodLabel } from "@/components/common/date-filter"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { StatCard } from "@/components/common/stat-card"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { useAction, useDelete, useList } from "@/lib/crud"
import { date, rupees } from "@/lib/format"
import type { Account, Expense, FinanceSummary, FinancialPeriod, JournalEntry, SyncResult, TaxRate } from "@/types/finance"
import { AccountDialog, EntryDialog, ExpenseDialog, FINANCE_LISTS, PeriodDialog, TaxRateDialog } from "./finance-forms"
import { BalancesPanel, CostingPanel, LedgerSheet, StatementsPanel } from "./finance-reports"
import { ACCOUNT_TYPES, ENTRY_SOURCES } from "./schemas"

type Tab = "dashboard" | "journal" | "expenses" | "accounts" | "balances" | "statements" | "costing" | "setup"
type Kind = "account" | "expense" | "period" | "tax"
type Editing =
  | { kind: "account"; record: Account | null }
  | { kind: "expense"; record: Expense | null }
  | { kind: "period"; record: FinancialPeriod | null }
  | { kind: "tax"; record: TaxRate | null }
  | { kind: "entry" }
type Deleting = { kind: Kind; id: number; label: string }

const ALL = "all"
const n = (v: string | number | null | undefined) => Number(v) || 0
const money = (v: string | number) => n(v).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const NOUN: Record<Kind, string> = { account: "account", expense: "expense", period: "period", tax: "tax rate" }
const RESOURCE: Record<Kind, string> = { account: "finance/accounts", expense: "finance/expenses", period: "finance/periods", tax: "finance/tax-rates" }

export function FinancePage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>("dashboard")
  const [period, setPeriod] = useState<DateFilterValue>({ type: "this_month" })
  const [source, setSource] = useState(ALL)
  const [accountType, setAccountType] = useState(ALL)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const [ledgerOf, setLedgerOf] = useState<Account | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)

  const params = dateParams(period)
  const summary = useQuery<FinanceSummary>({ queryKey: ["finance/summary"], queryFn: () => api("finance/summary") })
  const accounts = useList<Account>("finance/accounts")
  const entries = useList<JournalEntry>("finance/journal", params)
  const expenses = useList<Expense>("finance/expenses", params)
  const periods = useList<FinancialPeriod>("finance/periods")
  const taxRates = useList<TaxRate>("finance/tax-rates")

  const refresh = () => FINANCE_LISTS.forEach((key) => qc.invalidateQueries({ queryKey: key }))
  const { mutate: reverseEntry } = useAction("finance/journal", "reverse", { success: "Entry reversed.", invalidate: FINANCE_LISTS })
  const { mutate: closePeriod } = useAction("finance/periods", "close", { success: "Period closed; its entries are locked.", invalidate: FINANCE_LISTS })
  const { mutate: reopenPeriod } = useAction("finance/periods", "reopen", { success: "Period reopened.", invalidate: FINANCE_LISTS })
  const removers = {
    account: useDelete(RESOURCE.account, { noun: "Account", invalidate: FINANCE_LISTS }),
    expense: useDelete(RESOURCE.expense, { noun: "Expense", invalidate: FINANCE_LISTS }),
    period: useDelete(RESOURCE.period, { noun: "Period", invalidate: FINANCE_LISTS }),
    tax: useDelete(RESOURCE.tax, { noun: "Tax rate" }),
  }

  /** Posts, corrects or removes the entries that come from sales, purchasing and expenses. */
  const sync = async () => {
    setSyncing(true)
    try {
      const r = await api<SyncResult>("finance/journal/sync", { method: "POST", body: {} })
      const changed = r.posted + r.updated + r.removed
      toast.success(changed ? `Books updated: ${r.posted} posted, ${r.updated} corrected, ${r.removed} removed.` : "The books are already up to date.")
      if (r.skipped_closed) toast.warning(`${r.skipped_closed} change(s) fall in a closed period and were left as they are.`)
      refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the books.")
    } finally {
      setSyncing(false)
    }
  }

  const entryColumns = useMemo<TableColumn<JournalEntry>[]>(() => [
    { accessorKey: "number", header: "Number", cell: ({ row }) => (
      <button type="button" className="font-medium underline-offset-2 hover:underline"
        onClick={() => setExpanded((id) => (id === row.original.id ? null : row.original.id))}>{row.original.number}</button>
    ) },
    { id: "date", header: "Date", accessorFn: (r) => new Date(r.date), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.date)}</span> },
    { accessorKey: "memo", header: "For", cell: ({ row }) => (
      <span className="flex min-w-0 flex-col">
        <span className="line-clamp-1" title={row.original.memo}>{row.original.memo}</span>
        <span className="line-clamp-1 text-xs text-muted-foreground">
          {row.original.lines.map((l) => `${n(l.debit) ? "Dr" : "Cr"} ${l.account_name}`).join(" · ")}
        </span>
      </span>
    ) },
    { accessorKey: "source", header: "From", cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={row.original.source === "Manual" ? "Typed in" : row.original.source} tone={row.original.source === "Manual" ? "info" : "neutral"} />
        {row.original.reversed_by_number && <Badge variant="outline">Reversed by {row.original.reversed_by_number}</Badge>}
        {row.original.reverses_number && <Badge variant="outline">Reverses {row.original.reverses_number}</Badge>}
      </span>
    ) },
    { id: "total", header: "Amount", accessorFn: (r) => n(r.total), sortFn: "basic", cell: ({ row }) => <span className="font-medium tabular-nums">{rupees(row.original.total)}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const e = row.original
        const canReverse = e.source === "Manual" && !e.reverses && !e.reversed_by_number
        return <RowActions extra={[
          { label: expanded === e.id ? "Hide lines" : "Show lines", view: true, icon: <BookOpen className="size-4" />, onSelect: () => setExpanded((id) => (id === e.id ? null : e.id)) },
          ...(canReverse ? [{ label: "Reverse", icon: <Undo2 className="size-4" />, onSelect: () => reverseEntry({ id: e.id }) }] : []),
        ]} />
      } },
  ], [expanded, reverseEntry])

  const expenseColumns = useMemo<TableColumn<Expense>[]>(() => [
    { accessorKey: "number", header: "Number", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "date", header: "Date", accessorFn: (r) => new Date(r.date), sortFn: "datetime", cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.date)}</span> },
    { accessorKey: "description", header: "Paid for", cell: ({ row }) => (
      <span className="flex min-w-0 flex-col">
        <span className="line-clamp-1" title={row.original.description}>{row.original.description}</span>
        {row.original.payee && <span className="text-xs text-muted-foreground">{row.original.payee}</span>}
      </span>
    ) },
    { accessorKey: "account_name", header: "Account" },
    { accessorKey: "cost_centre", header: "Part of factory" },
    { accessorKey: "paid_from_name", header: "Paid from" },
    { id: "amount", header: "Amount", accessorFn: (r) => n(r.amount), sortFn: "basic", cell: ({ row }) => <span className="font-medium tabular-nums">{rupees(row.original.amount)}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions onEdit={() => setEditing({ kind: "expense", record: row.original })}
        onDelete={() => setDeleting({ kind: "expense", id: row.original.id, label: `${row.original.number} (${row.original.description})` })} /> },
  ], [])

  const accountColumns = useMemo<TableColumn<Account>[]>(() => [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{getValue<string>()}</span> },
    { accessorKey: "name", header: "Account", cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <span className="font-medium">{row.original.name}</span>
        {row.original.is_cash && <Badge variant="outline">Cash or bank</Badge>}
        {!row.original.is_active && <Badge variant="secondary">Not in use</Badge>}
      </span>
    ) },
    { accessorKey: "type", header: "Type" },
    { id: "balance", header: "Balance", accessorFn: (r) => n(r.balance), sortFn: "basic",
      cell: ({ row }) => n(row.original.balance)
        ? <span className="tabular-nums">{money(row.original.balance)}</span> : <span className="text-muted-foreground">—</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions
        extra={[{ label: "Ledger", view: true, icon: <BookOpen className="size-4" />, onSelect: () => setLedgerOf(row.original) }]}
        onEdit={() => setEditing({ kind: "account", record: row.original })}
        onDelete={row.original.is_system ? undefined : () => setDeleting({ kind: "account", id: row.original.id, label: `${row.original.code} ${row.original.name}` })} /> },
  ], [])

  const periodColumns = useMemo<TableColumn<FinancialPeriod>[]>(() => [
    { accessorKey: "name", header: "Period", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "dates", header: "Dates", accessorFn: (r) => new Date(r.start_date), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.start_date)} to {date(row.original.end_date)}</span> },
    { id: "status", header: "Status", accessorFn: (r) => (r.is_closed ? "Closed" : "Open"),
      cell: ({ row }) => <StatusBadge status={row.original.is_closed ? "Closed" : "Open"} tone={row.original.is_closed ? "neutral" : "success"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const p = row.original
        return <RowActions
          extra={[p.is_closed
            ? { label: "Reopen", icon: <LockOpen className="size-4" />, onSelect: () => reopenPeriod({ id: p.id }) }
            : { label: "Close period", icon: <Lock className="size-4" />, onSelect: () => closePeriod({ id: p.id }) }]}
          onEdit={p.is_closed ? undefined : () => setEditing({ kind: "period", record: p })}
          onDelete={p.is_closed ? undefined : () => setDeleting({ kind: "period", id: p.id, label: p.name })} />
      } },
  ], [closePeriod, reopenPeriod])

  const taxColumns = useMemo<TableColumn<TaxRate>[]>(() => [
    { accessorKey: "name", header: "Tax", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "rate", header: "Rate", accessorFn: (r) => n(r.rate), sortFn: "basic", cell: ({ row }) => <span className="tabular-nums">{n(row.original.rate)}%</span> },
    { id: "status", header: "Status", accessorFn: (r) => (r.is_active ? "In use" : "Not in use"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "In use" : "Not in use"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions onEdit={() => setEditing({ kind: "tax", record: row.original })}
        onDelete={() => setDeleting({ kind: "tax", id: row.original.id, label: row.original.name })} /> },
  ], [])

  const addFor: Record<Tab, { label: string; open: () => void }> = {
    dashboard: { label: "Record expense", open: () => setEditing({ kind: "expense", record: null }) },
    journal: { label: "New entry", open: () => setEditing({ kind: "entry" }) },
    expenses: { label: "Record expense", open: () => setEditing({ kind: "expense", record: null }) },
    accounts: { label: "New account", open: () => setEditing({ kind: "account", record: null }) },
    balances: { label: "Record expense", open: () => setEditing({ kind: "expense", record: null }) },
    statements: { label: "New entry", open: () => setEditing({ kind: "entry" }) },
    costing: { label: "Record expense", open: () => setEditing({ kind: "expense", record: null }) },
    setup: { label: "New period", open: () => setEditing({ kind: "period", record: null }) },
  }

  const core = [summary, accounts]
  const loadError = core.find((q) => q.isError)
  const s = summary.data
  const trend = (s?.trend ?? []).map((m) => ({
    month: new Date(`${m.month}-01`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
    income: n(m.income), expenses: n(m.expenses),
  }))
  const shownEntries = (entries.data ?? []).filter((e) => source === ALL || e.source === source)
  const open = expanded != null ? shownEntries.find((e) => e.id === expanded) : undefined
  const periodChip = period.type !== "all" ? [{ label: `Period: ${periodLabel(period)}`, onClear: () => setPeriod({ type: "all" }) }] : []

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Finance" icon="finance" description="Accounts, journal, expenses, balances and financial statements."
        actions={<>
          <Button variant="outline" onClick={sync} disabled={syncing}>
            <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} /> Update books
          </Button>
          <Button onClick={addFor[tab].open}><Plus className="size-4" /> {addFor[tab].label}</Button>
        </>} />

      {loadError ? (
        <ErrorState message={loadError.error!.message} onRetry={() => core.forEach((q) => q.refetch())} />
      ) : !s || !accounts.data ? (
        <TableSkeleton columns={6} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="journal">Journal</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
            <TabsTrigger value="statements">Statements</TabsTrigger>
            <TabsTrigger value="costing">Costing</TabsTrigger>
            <TabsTrigger value="setup">Setup</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Cash and bank" icon={Wallet} tone="finance" value={rupees(s.cash_total)} muted={!n(s.cash_total)}
                hint={s.cash.map((c) => `${c.name} ${rupees(c.balance)}`).join(" · ")} />
              <StatCard label="Customers owe us" icon={HandCoins} tone="info" value={rupees(s.receivable)} muted={!n(s.receivable)} />
              <StatCard label="We owe suppliers" icon={Landmark} tone="warning" value={rupees(s.payable)} muted={!n(s.payable)} />
              <StatCard label={n(s.profit_month) < 0 ? "Loss, this month" : "Profit, this month"} icon={TrendingUp}
                tone={n(s.profit_month) < 0 ? "danger" : "success"} value={rupees(Math.abs(n(s.profit_month)))} muted={!n(s.income_month) && !n(s.expenses_month)}
                hint={`${rupees(s.income_month)} income · ${rupees(s.expenses_month)} expenses`} />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <ChartCard title="Income and expenses" description="Last six months" className="xl:col-span-2"
                actions={<ChartLegend items={[{ label: "Income", color: "var(--success)" }, { label: "Expenses", color: "var(--stage-finance)" }]} />}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="month" {...axisProps} />
                    <YAxis {...yAxisProps} />
                    <Tooltip cursor={cursorProps} content={<ChartTooltip format={(v) => rupees(v)} />} />
                    <Bar dataKey="income" name="Income" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                    <Bar dataKey="expenses" name="Expenses" fill="var(--stage-finance)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <Card>
                <CardHeader>
                  <CardTitle>Largest expenses, this month</CardTitle>
                  <CardDescription>Year to date: {n(s.profit_year) < 0 ? "loss" : "profit"} of {rupees(Math.abs(n(s.profit_year)))}</CardDescription>
                </CardHeader>
                <CardContent>
                  {s.top_expenses.length ? (
                    <ul className="divide-y text-sm">
                      {s.top_expenses.map((e) => (
                        <li key={e.account} className="flex justify-between gap-3 py-2">
                          <span className="truncate">{e.name}</span><span className="shrink-0 font-medium tabular-nums">{rupees(e.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">No expenses recorded this month.</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="journal" className="mt-4 space-y-3">
            {entries.isError ? <ErrorState message={entries.error.message} onRetry={() => entries.refetch()} />
              : entries.isPending ? <TableSkeleton columns={5} />
              : <DataTable columns={entryColumns} data={shownEntries} searchPlaceholder="Search number, purpose…" emptyTitle="No journal entries"
                  emptyDescription="Entries appear here from sales, purchasing and expenses, or type one in." exportName="journal"
                  initialSorting={[{ id: "date", desc: true }]}
                  filters={[...(source !== ALL ? [{ label: `From: ${source}`, onClear: () => setSource(ALL) }] : []), ...periodChip]}
                  toolbar={<>
                    <Select value={source} onValueChange={setSource}>
                      <SelectTrigger className="h-9 w-[170px]" aria-label="Entry source"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All entries</SelectItem>
                        {ENTRY_SOURCES.map((x) => <SelectItem key={x} value={x}>{x === "Manual" ? "Typed in" : x}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <DateFilter value={period} onChange={setPeriod} />
                  </>} />}
            {open && (
              <Card>
                <CardHeader>
                  <CardTitle>{open.number}</CardTitle>
                  <CardDescription>{date(open.date)} · {open.memo}{open.reference ? ` · Ref ${open.reference}` : ""}</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <div className="grid min-w-80 grid-cols-[minmax(0,1fr)_auto_auto] gap-x-6 gap-y-1.5 text-sm tabular-nums">
                    <span className="text-xs text-muted-foreground">Account</span>
                    <span className="text-right text-xs text-muted-foreground">Debit</span><span className="text-right text-xs text-muted-foreground">Credit</span>
                    {open.lines.map((l) => (
                      <Fragment key={l.id}>
                        <span className="truncate">{l.account_code} {l.account_name}</span>
                        <span className="text-right">{n(l.debit) ? money(l.debit) : ""}</span>
                        <span className="text-right">{n(l.credit) ? money(l.credit) : ""}</span>
                      </Fragment>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="expenses" className="mt-4">
            {expenses.isError ? <ErrorState message={expenses.error.message} onRetry={() => expenses.refetch()} />
              : expenses.isPending ? <TableSkeleton columns={6} />
              : <DataTable columns={expenseColumns} data={expenses.data} searchPlaceholder="Search expense, payee, account…" emptyTitle="No expenses"
                  initialSorting={[{ id: "date", desc: true }]} exportName="expenses" filters={periodChip}
                  toolbar={<DateFilter value={period} onChange={setPeriod} />} />}
          </TabsContent>

          <TabsContent value="accounts" className="mt-4">
            <DataTable columns={accountColumns} data={accounts.data.filter((a) => accountType === ALL || a.type === accountType)}
              searchPlaceholder="Search code or name…" emptyTitle="No accounts" exportName="chart-of-accounts"
              filters={accountType !== ALL ? [{ label: `Type: ${accountType}`, onClear: () => setAccountType(ALL) }] : []}
              toolbar={
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger className="h-9 w-[150px]" aria-label="Account type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All types</SelectItem>
                    {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              } />
          </TabsContent>

          <TabsContent value="balances" className="mt-4"><BalancesPanel /></TabsContent>
          <TabsContent value="statements" className="mt-4"><StatementsPanel /></TabsContent>
          <TabsContent value="costing" className="mt-4"><CostingPanel /></TabsContent>

          <TabsContent value="setup" className="mt-4 grid gap-6 xl:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Periods</h3>
                <Button size="sm" variant="outline" onClick={() => setEditing({ kind: "period", record: null })}><Plus className="size-4" /> New period</Button>
              </div>
              <DataTable columns={periodColumns} data={periods.data ?? []} searchPlaceholder="Search periods…" emptyTitle="No periods"
                emptyDescription="Add a period to be able to close and lock it." initialSorting={[{ id: "dates", desc: true }]} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Tax rates</h3>
                <Button size="sm" variant="outline" onClick={() => setEditing({ kind: "tax", record: null })}><Plus className="size-4" /> New tax rate</Button>
              </div>
              <DataTable columns={taxColumns} data={taxRates.data ?? []} searchPlaceholder="Search tax rates…" emptyTitle="No tax rates" />
            </div>
          </TabsContent>
        </Tabs>
      )}

      <AccountDialog open={editing?.kind === "account"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "account" ? editing.record : null} />
      <EntryDialog open={editing?.kind === "entry"} onOpenChange={(o) => !o && setEditing(null)} accounts={accounts.data ?? []} />
      <ExpenseDialog open={editing?.kind === "expense"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "expense" ? editing.record : null} accounts={accounts.data ?? []} />
      <PeriodDialog open={editing?.kind === "period"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "period" ? editing.record : null} />
      <TaxRateDialog open={editing?.kind === "tax"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "tax" ? editing.record : null} />
      <LedgerSheet account={ledgerOf} onOpenChange={(o) => !o && setLedgerOf(null)} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting ? NOUN[deleting.kind] : ""}?`}
        description={deleting?.kind === "expense"
          ? `“${deleting.label}” and its journal entry will be removed.`
          : `“${deleting?.label}” will be removed. Records that depend on it can't be deleted.`}
        onConfirm={async () => {
          if (deleting) await removers[deleting.kind].mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
