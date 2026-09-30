"use client"

import { BadgeCheck, HandCoins, TrendingUp, Wallet } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { axisProps, ChartCard, ChartGradient, ChartTooltip, cursorProps, gridProps, yAxisProps } from "@/components/common/chart"
import { InitialsAvatar } from "@/components/common/identity"
import { SegmentedBar } from "@/components/common/meters"
import { StatCard } from "@/components/common/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { plural, rupees } from "@/lib/format"
import { monthlyTotals } from "@/lib/series"
import type { SalesOrder, SalesSummary } from "@/types/api"

const n = (v: string | number | null | undefined) => Number(v) || 0

/** Order value per month for the last `months` months (cancelled orders excluded). */
export function revenueByMonth(orders: SalesOrder[], months = 6, now = new Date()) {
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const inMonth = orders.filter((o) => {
      const od = new Date(o.created_at)
      return o.status !== "Cancelled" && od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth()
    })
    return {
      month: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      revenue: inMonth.reduce((a, o) => a + n(o.total_price), 0),
      orders: inMonth.length,
    }
  })
}

export function topCustomers(orders: SalesOrder[], limit = 5) {
  const byCustomer = new Map<string, { name: string; revenue: number; orders: number }>()
  for (const o of orders) {
    if (o.status === "Cancelled") continue
    const name = o.customer_name ?? o.buyer_name
    const row = byCustomer.get(name) ?? { name, revenue: 0, orders: 0 }
    row.revenue += n(o.total_price)
    row.orders += 1
    byCustomer.set(name, row)
  }
  return [...byCustomer.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}

export function SalesDashboard({ summary, orders }: { summary: SalesSummary; orders: SalesOrder[] }) {
  const monthly = revenueByMonth(orders)
  const top = topCustomers(orders)
  const maxTop = top[0]?.revenue || 1
  const live = orders.filter((o) => o.status !== "Cancelled")
  const revenueSpark = monthlyTotals(live, (o) => o.created_at, (o) => n(o.total_price))
  const paymentSpark = monthlyTotals(orders.flatMap((o) => o.payments), (p) => p.payment_date, (p) => n(p.amount))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total revenue" icon={TrendingUp} tone="sales" value={rupees(summary.total_revenue)} hint={plural(summary.total_orders, "order")} spark={revenueSpark} />
        <StatCard label="Collected" icon={Wallet} tone="success" value={rupees(summary.total_collected)} hint={plural(summary.payment_count, "payment")} spark={paymentSpark} />
        <StatCard label="Outstanding" icon={HandCoins} tone="warning" value={rupees(summary.pending_amount)} hint={`${plural(summary.pending_payments, "order")} unpaid`}
          footer={<SegmentedBar label="Collected and outstanding" segments={[
            { value: summary.total_collected, tone: "success", label: "Collected" },
            { value: summary.pending_amount, tone: "warning", label: "Outstanding" },
          ]} />} />
        <StatCard label="Paid orders" icon={BadgeCheck} tone="info" value={summary.paid_orders} hint={`${summary.completed_orders} completed`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard className="lg:col-span-3" title="Order value by month" description="Last 6 months, cancelled orders excluded" contentClassName="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ left: 0, right: 8, top: 8 }}>
              <ChartGradient id="sales-revenue" color="var(--chart-1)" />
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip cursor={cursorProps}
                content={<ChartTooltip format={(v) => rupees(v)} footer={(p) => plural(Number(p.orders), "order")} />} />
              <Bar dataKey="revenue" name="Order value" isAnimationActive={false} fill="url(#sales-revenue)" radius={[6, 6, 2, 2]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Card className="animate-rise lg:col-span-2">
          <CardHeader>
            <CardTitle>Top customers</CardTitle>
            <CardDescription className="mt-0.5">By order value</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {top.length ? top.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="w-4 text-xs font-semibold text-faint">{i + 1}</span>
                <InitialsAvatar name={c.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="shrink-0 font-semibold">{rupees(c.revenue)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="brand-gradient h-full rounded-full" style={{ width: `${(c.revenue / maxTop) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-faint">{plural(c.orders, "order")}</p>
                </div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No orders yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
