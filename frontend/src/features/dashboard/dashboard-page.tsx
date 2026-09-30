"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { DateFilter, type DateFilterValue, dateParams, matchesDate } from "@/components/common/date-filter"
import { PageHeader } from "@/components/common/page-header"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isLowStock } from "@/features/decolorization/decolorization-dashboard"
import { revenueByMonth } from "@/features/sales/sales-dashboard"
import { api } from "@/lib/api"
import { useList } from "@/lib/crud"
import { kg, rupees } from "@/lib/format"
import type { AuditEntry, Chemical, Page, SalesOrder, SalesSummary, SortingSession, StockEntry } from "@/types/api"

interface LotStock { fabric: number; material_type: string; on_hand_kg: string; reserved_kg: string; available_kg: string }

const n = (v: string | number | null | undefined) => Number(v) || 0
const compact = (v: number) => (v >= 1_000_000 ? `${Number((v / 1_000_000).toFixed(1))}M` : v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(v))
const PERIOD_LABEL: Record<DateFilterValue["type"], string> = {
  all: "all time", today: "today", this_week: "this week", this_month: "this month", this_year: "this year",
  year: "selected year", month: "selected month", custom: "selected range",
}

export function DashboardPage() {
  const [period, setPeriod] = useState<DateFilterValue>({ type: "this_month" })
  const [months, setMonths] = useState("6")
  const params = dateParams(period)

  const stock = useList<StockEntry>("warehouse/stock", params)
  const orders = useList<SalesOrder>("sales/orders", params)
  const allOrders = useList<SalesOrder>("sales/orders")
  const sessions = useList<SortingSession>("sorting/sessions")
  const chemicals = useList<Chemical>("decolorization/chemicals")
  const lots = useList<LotStock>("inventory/movements/stock")
  const summary = useQuery<SalesSummary>({ queryKey: ["sales/orders/summary"], queryFn: () => api("sales/orders/summary") })
  const activity = useQuery<Page<AuditEntry>>({
    queryKey: ["audit/logs", "recent"], queryFn: () => api("audit/logs", { params: { page: 1, page_size: 8 } }),
  })

  const all = [stock, orders, allOrders, sessions, chemicals, lots, summary]
  const failed = all.find((q) => q.isError)
  if (failed) return <ErrorState message={failed.error!.message} onRetry={() => all.forEach((q) => q.refetch())} />

  const ready = all.every((q) => q.data)
  const periodSessions = (sessions.data ?? []).filter((s) => matchesDate(s.start_date, period))
  const input = periodSessions.reduce((a, s) => a + n(s.quantity_taken), 0)
  const sorted = periodSessions.reduce((a, s) => a + n(s.quantity_sorted), 0)
  const periodOrders = (orders.data ?? []).filter((o) => o.status !== "Cancelled")
  const onHand = (lots.data ?? []).reduce((a, l) => a + n(l.on_hand_kg), 0)
  const reserved = (lots.data ?? []).reduce((a, l) => a + n(l.reserved_kg), 0)
  const oversold = (lots.data ?? []).filter((l) => n(l.available_kg) < 0)
  const lowChemicals = (chemicals.data ?? []).filter(isLowStock)
  const monthly = revenueByMonth(allOrders.data ?? [], Number(months))
  const label = PERIOD_LABEL[period.type]

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Dashboard" description="Factory overview from live records." actions={<DateFilter value={period} onChange={setPeriod} />} />

      {!ready ? <TableSkeleton rows={4} columns={4} /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={`Received, ${label}`} value={kg(stock.data!.reduce((a, s) => a + n(s.our_weight), 0))} hint={`${stock.data!.length} deliveries`} />
            <StatCard label={`Sorted, ${label}`} value={kg(sorted)} hint={input ? `${((sorted / input) * 100).toFixed(1)}% of ${kg(input)} taken` : `${periodSessions.length} sessions`} />
            <StatCard label="Sellable stock" value={kg(onHand)} hint={`${kg(reserved)} reserved · ${kg(onHand - reserved)} free`} />
            <StatCard label={`Orders, ${label}`} value={periodOrders.length} hint={rupees(periodOrders.reduce((a, o) => a + n(o.total_price), 0))} />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Collected (all time)" value={rupees(summary.data!.total_collected)} hint={`${summary.data!.payment_count} payments`} />
            <StatCard label="Outstanding" value={rupees(summary.data!.pending_amount)} hint={`${summary.data!.pending_payments} orders unpaid`} />
            <StatCard label="Completed orders" value={summary.data!.completed_orders} hint={`of ${summary.data!.total_orders}`} />
            <StatCard label="Chemicals" value={chemicals.data!.length} hint={lowChemicals.length ? `${lowChemicals.length} running low` : "All above 25%"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Order value by month</CardTitle>
                  <CardDescription>Cancelled orders excluded</CardDescription>
                </div>
                <Select value={months} onValueChange={setMonths}>
                  <SelectTrigger size="sm" className="w-[130px]" aria-label="Chart period"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">Last 6 months</SelectItem>
                    <SelectItem value="12">Last 12 months</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={56} tickFormatter={compact} />
                    <Tooltip cursor={{ className: "fill-muted" }}
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
                      formatter={(value, _n, item) => [`${rupees(Number(value))} · ${item.payload.orders} orders`, "Value"]} />
                    <Bar dataKey="revenue" isAnimationActive={false} fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Needs attention</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {lowChemicals.map((c) => (
                  <Link key={`c${c.id}`} href="/decolorization" className="flex items-start gap-2 rounded-md p-2 hover:bg-muted">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                    <span><span className="font-medium">{c.chemical_name}</span> is below 25% ({n(c.remaining_stock).toLocaleString()} {c.unit_of_measure} left)</span>
                  </Link>
                ))}
                {oversold.map((l) => (
                  <Link key={`l${l.fabric}`} href="/sales" className="flex items-start gap-2 rounded-md p-2 hover:bg-muted">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <span><span className="font-medium">{l.material_type}</span> has more reserved than on hand ({kg(-n(l.available_kg))} short)</span>
                  </Link>
                ))}
                {!lowChemicals.length && !oversold.length && (
                  <p className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-500" /> Nothing needs attention.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
            <CardContent>
              {activity.data?.results.length ? (
                <ul className="divide-y">
                  {activity.data.results.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                      <StatusBadge status={e.action.replace("_", " ")} tone={e.action === "DELETE" ? "danger" : e.action === "CREATE" ? "success" : e.action === "LOGIN_FAILED" ? "warning" : "neutral"} />
                      <span className="font-medium">{e.username || "system"}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.model_name} — {e.object_repr}</span>
                      <span className="text-xs text-muted-foreground">{e.timestamp_display}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}
              <Link href="/reports" className="mt-3 inline-block text-sm text-primary hover:underline">Open the full audit log</Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
