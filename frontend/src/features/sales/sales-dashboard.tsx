"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { StatCard } from "@/components/common/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { rupees } from "@/lib/format"
import type { SalesOrder, SalesSummary } from "@/types/api"

const n = (v: string | number | null | undefined) => Number(v) || 0

const compactRupees = (v: number) =>
  v >= 1_000_000 ? `${Number((v / 1_000_000).toFixed(1))}M` : v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(v)

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total revenue" value={rupees(summary.total_revenue)} hint={`${summary.total_orders} orders`} />
        <StatCard label="Collected" value={rupees(summary.total_collected)} hint={`${summary.payment_count} payments`} />
        <StatCard label="Outstanding" value={rupees(summary.pending_amount)} hint={`${summary.pending_payments} orders unpaid`} />
        <StatCard label="Paid orders" value={summary.paid_orders} hint={`${summary.completed_orders} completed`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Order value by month</CardTitle>
            <CardDescription>Last 6 months, cancelled orders excluded</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={56} tickFormatter={compactRupees} />
                <Tooltip
                  cursor={{ className: "fill-muted" }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
                  formatter={(value, _name, item) => [`${rupees(Number(value))} · ${item.payload.orders} orders`, "Value"]}
                />
                <Bar dataKey="revenue" isAnimationActive={false} fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top customers</CardTitle>
            <CardDescription>By order value</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {top.length ? top.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{rupees(c.revenue)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-chart-2" style={{ width: `${(c.revenue / maxTop) * 100}%` }} />
                </div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No orders yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
