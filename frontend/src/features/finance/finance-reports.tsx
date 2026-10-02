"use client"

// The statements (trial balance, profit and loss, balance sheet, cash flow), an
// account's ledger, who owes what, and production costing.
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, Coins, Factory, Scale, TriangleAlert } from "lucide-react"
import { useState } from "react"

import { StatCard } from "@/components/common/stat-card"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { today } from "@/features/procurement/schemas"
import { api } from "@/lib/api"
import { date, kg, percent, rupees } from "@/lib/format"
import { cn } from "@/lib/utils"
import type {
  Account, AccountLedger, BalanceSheet, Balances, CashFlow, Costing, ProfitAndLoss, StatementRow, TrialBalance,
} from "@/types/finance"

const n = (v: string | number | null | undefined) => Number(v) || 0
const money = (v: string | number | null | undefined) => n(v).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const yearStart = () => `${new Date().getFullYear()}-01-01`

/** From/to date inputs for a report. */
function Range({ start, end, onChange, single }: {
  start: string; end: string; onChange: (start: string, end: string) => void; single?: boolean
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {!single && (
        <div className="grid gap-1.5">
          <Label htmlFor="report-start" className="text-xs text-muted-foreground">From</Label>
          <Input id="report-start" type="date" value={start} max={end} onChange={(e) => onChange(e.target.value, end)} className="h-9 w-40" />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="report-end" className="text-xs text-muted-foreground">{single ? "As of" : "To"}</Label>
        <Input id="report-end" type="date" value={end} min={single ? undefined : start} onChange={(e) => onChange(start, e.target.value)} className="h-9 w-40" />
      </div>
    </div>
  )
}

function useReport<T>(path: string, params: Record<string, string>, enabled = true) {
  return useQuery<T>({ queryKey: [`finance/${path}`, params], queryFn: () => api(`finance/${path}`, { params }), enabled })
}

/** A statement block: rows of accounts with a total line. */
function Section({ title, rows, total, totalLabel, extra }: {
  title: string; rows: StatementRow[]; total: string; totalLabel: string; extra?: { label: string; amount: string }[]
}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <table className="w-full text-sm">
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.account} className="border-b border-border/60 [&>td]:py-1.5">
              <td className="w-16 text-muted-foreground">{r.code}</td>
              <td>{r.name}</td>
              <td className="text-right">{money(r.amount)}</td>
            </tr>
          ))}
          {extra?.map((r) => (
            <tr key={r.label} className="border-b border-border/60 [&>td]:py-1.5">
              <td /><td>{r.label}</td><td className="text-right">{money(r.amount)}</td>
            </tr>
          ))}
          {!rows.length && !extra?.length && <tr><td colSpan={3} className="py-2 text-muted-foreground">Nothing recorded.</td></tr>}
          <tr className="font-semibold [&>td]:pt-2">
            <td /><td>{totalLabel}</td><td className="text-right">{money(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function Balanced({ ok, text }: { ok: boolean; text: string }) {
  return ok
    ? <Badge variant="outline" className="text-success-fg"><CheckCircle2 aria-hidden /> {text}</Badge>
    : <Badge variant="destructive"><TriangleAlert aria-hidden /> Does not balance</Badge>
}

const STATEMENTS = [
  { value: "profit-and-loss", label: "Profit and loss" },
  { value: "balance-sheet", label: "Balance sheet" },
  { value: "trial-balance", label: "Trial balance" },
  { value: "cash-flow", label: "Cash flow" },
] as const
type Statement = (typeof STATEMENTS)[number]["value"]

export function StatementsPanel() {
  const [statement, setStatement] = useState<Statement>("profit-and-loss")
  const [start, setStart] = useState(yearStart)
  const [end, setEnd] = useState(today)
  const single = statement === "balance-sheet" || statement === "trial-balance"
  const range = { start, end }
  const asOf = { as_of: end }

  const pl = useReport<ProfitAndLoss>("profit-and-loss", range, statement === "profit-and-loss")
  const bs = useReport<BalanceSheet>("balance-sheet", asOf, statement === "balance-sheet")
  const tb = useReport<TrialBalance>("trial-balance", asOf, statement === "trial-balance")
  const cf = useReport<CashFlow>("cash-flow", range, statement === "cash-flow")
  const current = { "profit-and-loss": pl, "balance-sheet": bs, "trial-balance": tb, "cash-flow": cf }[statement]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="statement" className="text-xs text-muted-foreground">Statement</Label>
          <Select value={statement} onValueChange={(v) => setStatement(v as Statement)}>
            <SelectTrigger id="statement" className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{STATEMENTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Range start={start} end={end} single={single} onChange={(s, e) => { setStart(s); setEnd(e) }} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STATEMENTS.find((s) => s.value === statement)!.label}</CardTitle>
          <CardDescription>{single ? `As of ${date(end)}` : `${date(start)} to ${date(end)}`} · amounts in rupees</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {current.isError ? <ErrorState message={current.error.message} onRetry={() => current.refetch()} />
            : !current.data ? <TableSkeleton columns={3} rows={5} />
            : statement === "profit-and-loss" && pl.data ? (
              <>
                <Section title="Income" rows={pl.data.income} total={pl.data.total_income} totalLabel="Total income" />
                <Section title="Expenses" rows={pl.data.expenses} total={pl.data.total_expenses} totalLabel="Total expenses" />
                <p className={cn("flex items-baseline justify-between border-t-2 pt-3 font-heading text-lg font-bold tabular-nums",
                  n(pl.data.net_profit) < 0 && "text-danger-fg")}>
                  <span>{n(pl.data.net_profit) < 0 ? "Net loss" : "Net profit"}</span><span>{money(Math.abs(n(pl.data.net_profit)))}</span>
                </p>
              </>
            ) : statement === "balance-sheet" && bs.data ? (
              <>
                <Section title="Assets" rows={bs.data.assets} total={bs.data.total_assets} totalLabel="Total assets" />
                <Section title="Liabilities" rows={bs.data.liabilities} total={bs.data.total_liabilities} totalLabel="Total liabilities" />
                <Section title="Equity" rows={bs.data.equity} total={bs.data.total_equity} totalLabel="Total equity"
                  extra={[{ label: "Profit kept in the business", amount: bs.data.retained_earnings }]} />
                <Balanced ok={bs.data.balanced} text="Assets equal liabilities plus equity" />
              </>
            ) : statement === "trial-balance" && tb.data ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b text-left [&>th]:py-2 [&>th]:font-medium">
                        <th className="w-16">Code</th><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {tb.data.rows.map((r) => (
                        <tr key={r.account} className="border-b border-border/60 [&>td]:py-1.5">
                          <td className="text-muted-foreground">{r.code}</td><td>{r.name}</td>
                          <td className="text-right">{n(r.debit) ? money(r.debit) : ""}</td>
                          <td className="text-right">{n(r.credit) ? money(r.credit) : ""}</td>
                        </tr>
                      ))}
                      {!tb.data.rows.length && <tr><td colSpan={4} className="py-2 text-muted-foreground">Nothing recorded.</td></tr>}
                      <tr className="font-semibold [&>td]:pt-2">
                        <td /><td>Total</td><td className="text-right">{money(tb.data.debit)}</td><td className="text-right">{money(tb.data.credit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <Balanced ok={tb.data.balanced} text="Debits equal credits" />
              </>
            ) : cf.data ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b text-left [&>th]:py-2 [&>th]:font-medium">
                      <th>Cash and bank</th><th className="text-right">Money in</th><th className="text-right">Money out</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    <tr className="border-b border-border/60 [&>td]:py-1.5"><td>Opening balance</td><td /><td className="text-right">{money(cf.data.opening)}</td></tr>
                    {cf.data.rows.map((r) => (
                      <tr key={r.source} className="border-b border-border/60 [&>td]:py-1.5">
                        <td>{r.source === "Manual" ? "Journal entries" : `${r.source}s`}</td>
                        <td className="text-right">{n(r.inflow) ? money(r.inflow) : ""}</td>
                        <td className="text-right">{n(r.outflow) ? money(r.outflow) : ""}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-border/60 font-medium [&>td]:py-1.5">
                      <td>Total</td><td className="text-right">{money(cf.data.inflow)}</td><td className="text-right">{money(cf.data.outflow)}</td>
                    </tr>
                    <tr className="[&>td]:py-1.5"><td>Net change</td><td /><td className="text-right">{money(cf.data.net)}</td></tr>
                    <tr className="font-semibold [&>td]:pt-2"><td>Closing balance</td><td /><td className="text-right">{money(cf.data.closing)}</td></tr>
                  </tbody>
                </table>
              </div>
            ) : null}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        These statements come from the journal. A sale is counted when it is invoiced and a purchase when the supplier&apos;s invoice is entered.
        They support your own bookkeeping and are not a certified statutory report.
      </p>
    </div>
  )
}

// ─── One account's ledger ───────────────────────────────────────────────────

export function LedgerSheet({ account, onOpenChange }: { account: Account | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={!!account} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 bg-elevated p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {account && <LedgerBody key={account.id} account={account} />}
      </SheetContent>
    </Sheet>
  )
}

function LedgerBody({ account }: { account: Account }) {
  const query = useQuery<AccountLedger>({
    queryKey: ["finance/accounts", account.id, "ledger"], queryFn: () => api(`finance/accounts/${account.id}/ledger`),
  })
  const data = query.data
  return (
    <>
      <SheetHeader className="border-b px-6 pt-5 pb-4">
        <SheetTitle className="font-heading text-lg font-semibold tracking-tight">{account.code} {account.name}</SheetTitle>
        <SheetDescription>{account.type} account · every entry with a running balance</SheetDescription>
      </SheetHeader>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {query.isError ? <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
          : !data ? <TableSkeleton columns={4} />
          : data.rows.length ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                    <th>Date</th><th>Entry</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data.rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2">
                      <td className="whitespace-nowrap text-muted-foreground">{date(r.date)}</td>
                      <td><span className="font-medium">{r.number}</span> <span className="text-muted-foreground">{r.memo}</span></td>
                      <td className="text-right">{n(r.debit) ? money(r.debit) : ""}</td>
                      <td className="text-right">{n(r.credit) ? money(r.credit) : ""}</td>
                      <td className="text-right font-medium">{money(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">No entries on this account yet.</p>}
      </div>
    </>
  )
}

// ─── Who owes what ──────────────────────────────────────────────────────────

export function BalancesPanel() {
  const query = useReport<Balances>("balances", {})
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
  if (!query.data) return <TableSkeleton columns={3} />
  const data = query.data
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Customers owe us</CardTitle>
          <CardDescription>{rupees(data.total_receivable)} · confirmed orders less payments and return credits</CardDescription>
        </CardHeader>
        <CardContent>
          {data.receivables.length ? (
            <ul className="divide-y text-sm">
              {data.receivables.map((r) => (
                <li key={r.customer} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{r.name}</span>
                    {r.over_limit && <Badge variant="destructive">Over limit</Badge>}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{rupees(r.balance)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No customer owes anything.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>We owe suppliers</CardTitle>
          <CardDescription>{rupees(data.total_payable)} · unpaid supplier invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {data.payables.length ? (
            <ul className="divide-y text-sm">
              {data.payables.map((r) => (
                <li key={r.supplier} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{r.name}</span>
                    {n(r.overdue) > 0 && <Badge variant="destructive">{rupees(r.overdue)} overdue</Badge>}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{rupees(r.balance)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nothing is owed to suppliers.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Production costing ─────────────────────────────────────────────────────

export function CostingPanel() {
  const [start, setStart] = useState(yearStart)
  const [end, setEnd] = useState(today)
  const query = useReport<Costing>("costing", { start, end })
  const data = query.data
  return (
    <div className="space-y-4">
      <Range start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e) }} />
      {query.isError ? <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
        : !data ? <TableSkeleton columns={4} />
        : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Production cost" icon={Coins} tone="finance" value={rupees(data.total)} muted={!n(data.total)} />
              <StatCard label="Dried output" icon={Scale} tone="drying" value={kg(data.output_kg)} muted={!n(data.output_kg)} hint="Completed drying sessions" />
              <StatCard label="Cost per kg" icon={Coins} tone="warning" muted={data.cost_per_kg == null}
                value={data.cost_per_kg == null ? "—" : `Rs. ${money(data.cost_per_kg)}`} hint="Production cost over dried output" />
              <StatCard label="Orders: actual vs estimate" icon={Factory} tone={n(data.order_variance) > 0 ? "danger" : "success"} muted={!data.orders}
                value={data.orders ? rupees(data.actual_order_cost) : "—"}
                hint={data.orders ? `Estimated ${rupees(data.estimated_order_cost)} on ${data.orders} production orders` : "No production orders in the period"} />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader><CardTitle>Cost by kind</CardTitle><CardDescription>What each figure is taken from is shown beside it</CardDescription></CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b text-left [&>th]:py-2 [&>th]:font-medium"><th>Cost</th><th>Taken from</th><th className="text-right">Amount</th><th className="text-right">Share</th></tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {data.rows.map((r) => (
                        <tr key={r.kind} className="border-b border-border/60 [&>td]:py-1.5">
                          <td className="font-medium">{r.kind}</td><td className="text-muted-foreground">{r.basis}</td>
                          <td className="text-right">{money(r.amount)}</td>
                          <td className="text-right text-muted-foreground">{r.share_pct == null ? "—" : percent(r.share_pct)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold [&>td]:pt-2"><td>Total</td><td /><td className="text-right">{money(data.total)}</td><td /></tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Expenses by part of the factory</CardTitle></CardHeader>
                <CardContent>
                  {data.by_cost_centre.length ? (
                    <ul className="divide-y text-sm">
                      {data.by_cost_centre.map((c) => (
                        <li key={c.cost_centre} className="flex justify-between gap-3 py-2"><span>{c.cost_centre}</span><span className="font-medium tabular-nums">{rupees(c.amount)}</span></li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">No expenses in this period.</p>}
                </CardContent>
              </Card>
            </div>
          </>
        )}
    </div>
  )
}
