"use client"

import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle, ArrowRight, CheckCircle2, FlaskConical, HandCoins, PackageCheck, Receipt, RefreshCw, ShoppingCart,
  Truck, Wallet, Warehouse,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { axisProps, ChartCard, ChartGradient, ChartTooltip, cursorProps, gridProps, yAxisProps } from "@/components/common/chart"
import { DateFilter, type DateFilterValue, matchesDate, previousPeriod } from "@/components/common/date-filter"
import { Delta } from "@/components/common/figure"
import { InitialsAvatar } from "@/components/common/identity"
import { ProgressBar, SegmentedBar } from "@/components/common/meters"
import { PageHeader } from "@/components/common/page-header"
import { PipelineStrip, type PipelineStage } from "@/components/common/pipeline-strip"
import { CardsSkeleton, ErrorState } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge, type StatusTone } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "@/features/auth/use-session"
import { revenueByMonth } from "@/features/sales/sales-dashboard"
import { api } from "@/lib/api"
import { useList } from "@/lib/crud"
import { displayName, kg, plural, relativeTime, rupees } from "@/lib/format"
import { monthlyTotals } from "@/lib/series"
import { cn } from "@/lib/utils"
import type {
  AuditEntry, DecolorizationSession, DryingSession, Page, SalesOrder, SalesSummary, SortingSession, StockEntry,
} from "@/types/api"
import { useAttention } from "./use-attention"

const n = (v: string | number | null | undefined) => Number(v) || 0
const sum = <T,>(rows: T[], get: (r: T) => number) => rows.reduce((a, r) => a + get(r), 0)

const PERIOD_LABEL: Record<DateFilterValue["type"], string> = {
  all: "all time", today: "today", this_week: "this week", this_month: "this month", this_year: "this year",
  year: "selected year", month: "selected month", custom: "selected range",
}

const ACTION_TONES: Record<string, StatusTone> = {
  CREATE: "success", UPDATE: "info", DELETE: "danger", LOGIN: "neutral", LOGIN_FAILED: "warning", EXPORT: "neutral",
}

export function DashboardPage() {
  const [period, setPeriod] = useState<DateFilterValue>({ type: "this_month" })
  const [months, setMonths] = useState("6")
  const role = useSession().data?.role

  const stock = useList<StockEntry>("warehouse/stock")
  const orders = useList<SalesOrder>("sales/orders")
  const sorting = useList<SortingSession>("sorting/sessions")
  const decolor = useList<DecolorizationSession>("decolorization/sessions")
  const drying = useList<DryingSession>("drying/sessions")
  const attention = useAttention(role)
  const summary = useQuery<SalesSummary>({ queryKey: ["sales/orders/summary"], queryFn: () => api("sales/orders/summary") })
  const activity = useQuery<Page<AuditEntry>>({
    queryKey: ["audit/logs", "recent"], queryFn: () => api("audit/logs", { params: { page: 1, page_size: 8 } }),
  })

  const core = [stock, orders, sorting, decolor, drying, summary]
  const all = [...core, attention.chemicals, attention.lots]
  const failed = all.find((q) => q.isError)
  if (failed) return <ErrorState message={failed.error!.message} onRetry={() => all.forEach((q) => q.refetch())} />

  const ready = core.every((q) => q.data) && !!attention.lots.data && !!attention.chemicals.data
  const updatedAt = Math.max(...all.map((q) => q.dataUpdatedAt))
  const refreshing = all.some((q) => q.isFetching)
  const prev = previousPeriod(period)
  const label = PERIOD_LABEL[period.type]

  // Figures for the chosen period, and the one before it
  const figures = (p: DateFilterValue) => {
    const received = (stock.data ?? []).filter((s) => matchesDate(s.created_at, p))
    const sessions = (sorting.data ?? []).filter((s) => matchesDate(s.start_date, p))
    const periodOrders = (orders.data ?? []).filter((o) => o.status !== "Cancelled" && matchesDate(o.created_at, p))
    return {
      receivedKg: sum(received, (s) => n(s.our_weight)),
      deliveries: received.length,
      takenKg: sum(sessions, (s) => n(s.quantity_taken)),
      sortedKg: sum(sessions, (s) => n(s.quantity_sorted)),
      sessions: sessions.length,
      orders: periodOrders.length,
      orderValue: sum(periodOrders, (o) => n(o.total_price)),
      decolorKg: sum((decolor.data ?? []).filter((s) => s.status === "Completed" && matchesDate(s.end_date ?? s.start_date, p)), (s) => n(s.output_quantity)),
      driedKg: sum((drying.data ?? []).filter((s) => s.status === "Completed" && matchesDate(s.end_date ?? s.start_date ?? s.created_at, p)), (s) => n(s.output_quantity)),
    }
  }
  const now = figures(period)
  const before = prev ? figures(prev.filter) : null

  const lots = attention.lots.data ?? []
  const onHand = sum(lots, (l) => n(l.on_hand_kg))
  const reserved = sum(lots, (l) => n(l.reserved_kg))
  const lowChemicals = attention.items.filter((i) => i.id.startsWith("chemical")).length
  const s = summary.data
  const inProgress = <T extends { status: string }>(rows: T[] | undefined) => (rows ?? []).filter((r) => r.status === "In Progress").length

  const spark = {
    received: monthlyTotals(stock.data ?? [], (r) => r.created_at, (r) => n(r.our_weight)),
    sorted: monthlyTotals(sorting.data ?? [], (r) => r.start_date, (r) => n(r.quantity_sorted)),
    orders: monthlyTotals((orders.data ?? []).filter((o) => o.status !== "Cancelled"), (r) => r.created_at, (r) => n(r.total_price)),
  }
  const delta = (current: number, previous: number | undefined, goodWhen: "up" | "down" = "up") =>
    prev && previous !== undefined ? <Delta current={current} previous={previous} goodWhen={goodWhen} label={prev.vs} /> : undefined
  // "0 kg" on its own looks broken: say what the previous period had
  const zeroHint = (current: number, previous: number | undefined, format: (v: number) => string) =>
    current === 0 && prev && previous ? `${prev.short}: ${format(previous)}` : undefined

  const stages: PipelineStage[] = [
    { key: "warehouse", title: "Warehouse", tone: "warehouse", icon: "warehouse", href: "/warehouse", value: kg(now.receivedKg),
      caption: `received · ${plural(now.deliveries, "delivery", "deliveries")}`,
      active: (stock.data ?? []).filter((x) => x.status === "Pending").length,
      activeLabel: `${(stock.data ?? []).filter((x) => x.status === "Pending").length} pending approval` },
    { key: "sorting", title: "Sorting", tone: "sorting", icon: "sorting", href: "/sorting", value: kg(now.sortedKg),
      caption: "sorted", active: inProgress(sorting.data), activeLabel: `${inProgress(sorting.data)} in progress` },
    { key: "decolorization", title: "Decolorization", tone: "decolorization", icon: "decolorization", href: "/decolorization", value: kg(now.decolorKg),
      caption: "decolorized output", active: inProgress(decolor.data), activeLabel: `${inProgress(decolor.data)} in progress` },
    { key: "drying", title: "Drying", tone: "drying", icon: "drying", href: "/drying", value: kg(now.driedKg),
      caption: "dried output", active: inProgress(drying.data), activeLabel: `${inProgress(drying.data)} in progress` },
    { key: "sales", title: "Sellable stock", tone: "sales", icon: "sales", href: "/sales", value: kg(onHand - reserved),
      caption: "free to sell now", activeLabel: `${kg(reserved)} reserved` },
  ]

  const monthly = revenueByMonth(orders.data ?? [], Number(months))

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <PageHeader
        title="Dashboard"
        icon="dashboard"
        description="Factory overview from live records."
        meta={ready && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-success text-success" aria-hidden />
            Updated {new Date(updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        actions={
          <>
            <DateFilter value={period} onChange={setPeriod} />
            <Button variant="outline" size="icon" className="size-9" aria-label="Refresh" disabled={refreshing}
              onClick={() => all.forEach((q) => q.refetch())}>
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            </Button>
          </>
        }
      />

      {!ready ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <CardsSkeleton />
          <CardsSkeleton />
        </div>
      ) : (
        <>
          <PipelineStrip title="Material flow" description={`Kilograms through each stage, ${label}`} stages={stages} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={`Received, ${label}`} icon={Warehouse} tone="warehouse" value={kg(now.receivedKg)} muted={now.receivedKg === 0}
              delta={delta(now.receivedKg, before?.receivedKg)}
              hint={zeroHint(now.receivedKg, before?.receivedKg, kg) ?? plural(now.deliveries, "delivery", "deliveries")}
              spark={spark.received} />
            <StatCard label={`Sorted, ${label}`} icon={PackageCheck} tone="sorting" value={kg(now.sortedKg)} muted={now.sortedKg === 0}
              delta={delta(now.sortedKg, before?.sortedKg)}
              hint={zeroHint(now.sortedKg, before?.sortedKg, kg)
                ?? (now.takenKg ? `${((now.sortedKg / now.takenKg) * 100).toFixed(1)}% of ${kg(now.takenKg)} taken` : plural(now.sessions, "session"))}
              spark={spark.sorted} />
            <StatCard label="Sellable stock" icon={Truck} tone="sales" value={kg(onHand)}
              hint={`${kg(reserved)} reserved · ${kg(onHand - reserved)} free`}
              footer={<SegmentedBar label="Reserved and free stock" segments={[
                { value: reserved, tone: "warning", label: "Reserved" },
                { value: Math.max(0, onHand - reserved), tone: "success", label: "Free" },
              ]} />} />
            <StatCard label={`Orders, ${label}`} icon={ShoppingCart} tone="brand" value={now.orders} muted={now.orders === 0}
              delta={delta(now.orderValue, before?.orderValue)}
              hint={zeroHint(now.orders, before?.orders, (v) => plural(v, "order")) ?? rupees(now.orderValue)}
              spark={spark.orders} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Collected (all time)" icon={Wallet} tone="success" value={rupees(s!.total_collected)}
              hint={plural(s!.payment_count, "payment")} />
            <StatCard label="Outstanding" icon={HandCoins} tone="warning" value={rupees(s!.pending_amount)}
              hint={`${plural(s!.pending_payments, "order")} unpaid`}
              footer={<SegmentedBar label="Collected and outstanding" segments={[
                { value: s!.total_collected, tone: "success", label: "Collected" },
                { value: s!.pending_amount, tone: "warning", label: "Outstanding" },
              ]} />} />
            <StatCard label="Completed orders" icon={Receipt} tone="info" value={s!.completed_orders} hint={`of ${s!.total_orders.toLocaleString("en-PK")}`}
              footer={<ProgressBar value={s!.total_orders ? (s!.completed_orders / s!.total_orders) * 100 : 0} tone="info" label="Share of orders completed" />} />
            <StatCard label="Chemicals" icon={FlaskConical} tone={lowChemicals ? "warning" : "decolorization"} value={(attention.chemicals.data ?? []).length}
              hint={lowChemicals ? `${lowChemicals} running low` : "All above 25%"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard className="lg:col-span-2" title="Order value by month" description="Cancelled orders excluded" contentClassName="h-72"
              actions={
                <Select value={months} onValueChange={setMonths}>
                  <SelectTrigger size="sm" className="w-[140px]" aria-label="Chart period"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">Last 6 months</SelectItem>
                    <SelectItem value="12">Last 12 months</SelectItem>
                  </SelectContent>
                </Select>
              }>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ left: 0, right: 8, top: 8 }}>
                  <ChartGradient id="dash-revenue" color="var(--chart-1)" />
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...yAxisProps} />
                  <Tooltip cursor={cursorProps}
                    content={<ChartTooltip format={(v) => rupees(v)} footer={(p) => plural(Number(p.orders), "order")} />} />
                  <Bar dataKey="revenue" name="Order value" isAnimationActive={false} fill="url(#dash-revenue)" radius={[6, 6, 2, 2]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card className="animate-rise">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Needs attention</CardTitle>
                  <CardDescription className="mt-0.5">{attention.items.length ? `${attention.items.length} open, most urgent first` : "All clear"}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="scrollbar-thin max-h-80 space-y-1 overflow-y-auto">
                {attention.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60">
                    <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                      item.severity === "critical" ? "bg-danger/12 text-danger-fg" : "bg-warning/12 text-warning-fg")}>
                      <AlertTriangle className="size-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-sm"><span className="font-medium">{item.title}</span> <span className="text-muted-foreground">{item.detail}</span></p>
                      {item.share !== undefined && (
                        <ProgressBar value={item.share} threshold={25} size="sm" tone={item.severity === "critical" ? "danger" : "warning"}
                          label={`${item.title} stock left`} />
                      )}
                    </div>
                    <Button asChild variant="ghost" size="xs" className="shrink-0 text-brand-text">
                      <Link href={item.href}>{item.action}</Link>
                    </Button>
                  </div>
                ))}
                {!attention.items.length && (
                  <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-4 text-success-fg" aria-hidden /> Nothing needs attention.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="animate-rise">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription className="mt-0.5">Latest changes from the audit log</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-brand-text">
                <Link href="/reports">Full audit log <ArrowRight className="size-3.5" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {activity.data?.results.length ? (
                <ul className="relative space-y-0.5 before:absolute before:top-3 before:bottom-3 before:left-[13px] before:w-px before:bg-border">
                  {activity.data.results.map((e) => (
                    <li key={e.id} className="relative flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg py-2 pr-2 text-sm">
                      <InitialsAvatar name={e.username || "system"} className="ring-4 ring-card" />
                      <span className="font-medium">{displayName(e.username) || "System"}</span>
                      <StatusBadge status={e.action.replace("_", " ")} tone={ACTION_TONES[e.action] ?? "neutral"} />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.model_name} · {e.object_repr}</span>
                      <span className="text-xs text-faint" title={e.timestamp_display}>{relativeTime(e.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              ) : activity.isPending ? <Skeleton className="h-40 w-full" />
                : <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
