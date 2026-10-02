"use client"

// Breakdowns, downtime, cost and availability per machine over a chosen period.
import { useQuery } from "@tanstack/react-query"
import { Activity, Coins, Timer, TriangleAlert } from "lucide-react"
import { useMemo, useState } from "react"

import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, dateParams } from "@/components/common/date-filter"
import { StatCard } from "@/components/common/stat-card"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { date, percent, plural, rupees } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { MachinePerformance, MaintenancePerformance } from "@/types/maintenance"

const hours = (v: string | number) => `${Number(v).toLocaleString("en-PK", { maximumFractionDigits: 1 })} h`

export function PerformancePanel() {
  const [period, setPeriod] = useState<DateFilterValue>({ type: "all" })
  const params = dateParams(period)
  const report = useQuery<MaintenancePerformance>({
    queryKey: ["maintenance/performance", params], queryFn: () => api("maintenance/performance", { params }),
  })

  const columns = useMemo<TableColumn<MachinePerformance>[]>(() => [
    { accessorKey: "code", header: "Machine",
      cell: ({ row }) => (
        <span><span className="font-medium">{row.original.code}</span>
          <span className="block max-w-56 truncate text-xs text-muted-foreground">{row.original.name}</span></span>
      ) },
    { accessorKey: "breakdowns", header: "Breakdowns", sortFn: "basic",
      cell: ({ getValue }) => <span className={cn("tabular-nums", getValue<number>() > 0 && "font-medium text-danger-fg")}>{getValue<number>()}</span> },
    { id: "downtime", header: "Downtime", accessorFn: (r) => Number(r.downtime_hours), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{hours(row.original.downtime_hours)}</span> },
    { id: "availability", header: "Availability", accessorFn: (r) => r.availability_pct, sortFn: "basic",
      cell: ({ row }) => {
        const pct = row.original.availability_pct
        return <span className={cn("tabular-nums", pct < 95 ? "font-medium text-danger-fg" : pct < 99 ? "text-warning-fg" : "")}>{percent(pct)}</span>
      } },
    { id: "mtbf", header: "Time between failures", accessorFn: (r) => r.mtbf_days ?? -1, sortFn: "basic",
      cell: ({ row }) => row.original.mtbf_days == null
        ? <span className="text-muted-foreground">—</span>
        : <span className="tabular-nums">{row.original.mtbf_days} days</span> },
    { id: "cost", header: "Maintenance cost", accessorFn: (r) => Number(r.cost), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.cost)}</span> },
    { id: "downtime_cost", header: "Cost of downtime", accessorFn: (r) => Number(r.downtime_cost), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{rupees(row.original.downtime_cost)}</span> },
  ], [])

  const data = report.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DateFilter value={period} onChange={setPeriod} />
        <span className="text-sm text-muted-foreground">
          {data ? `${date(data.start)} to ${date(data.end)} (${plural(data.days, "day")})` : ""}
          {period.type === "all" && " · “All time” shows the last 90 days"}
        </span>
      </div>
      {report.isError ? <ErrorState message={report.error.message} onRetry={() => report.refetch()} />
        : !data ? <TableSkeleton columns={7} />
        : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Availability" icon={Activity} tone="maintenance" muted={data.availability_pct == null}
                value={data.availability_pct == null ? "—" : percent(data.availability_pct)} hint="Time the machines were not stopped for repair" />
              <StatCard label="Breakdowns" icon={TriangleAlert} tone={data.breakdowns ? "danger" : "success"} value={data.breakdowns}
                muted={!data.breakdowns} hint="By the date they were reported" />
              <StatCard label="Downtime" icon={Timer} tone="warning" value={hours(data.downtime_hours)} muted={!Number(data.downtime_hours)}
                hint="Recorded on work orders" />
              <StatCard label="Maintenance cost" icon={Coins} tone="info" value={rupees(data.cost)} muted={!Number(data.cost)}
                hint="Labour, parts and other costs" />
            </div>
            <DataTable columns={columns} data={data.machines} searchPlaceholder="Search machines…" emptyTitle="No machines"
              emptyDescription="Machines in the register show here." initialSorting={[{ id: "downtime", desc: true }]} exportName="machine-performance" />
            <Card className="animate-rise">
              <CardHeader>
                <CardTitle>Effect on production</CardTitle>
                <CardDescription className="mt-0.5">Downtime of machines linked to a tank or dryer, next to the batches run on it in the period</CardDescription>
              </CardHeader>
              <CardContent>
                {data.impact.length ? (
                  <ul className="divide-y rounded-xl border">
                    {data.impact.map((row) => (
                      <li key={row.machine} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                        <span className="min-w-0 flex-1 basis-48">
                          <span className="block truncate font-medium">{row.code} · {row.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{row.equipment_kind}: {row.equipment}</span>
                        </span>
                        <span className="tabular-nums">{plural(row.sessions, row.equipment_kind === "Tank" ? "decolorization batch" : "drying batch", row.equipment_kind === "Tank" ? "decolorization batches" : "drying batches")}</span>
                        <span className={cn("tabular-nums", Number(row.downtime_hours) > 0 ? "font-medium text-danger-fg" : "text-muted-foreground")}>
                          {hours(row.downtime_hours)} stopped · {plural(row.breakdowns, "breakdown")}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="py-4 text-sm text-muted-foreground">No machine is linked to a tank or dryer yet. Set the link on the machine.</p>}
              </CardContent>
            </Card>
          </>
        )}
    </div>
  )
}
