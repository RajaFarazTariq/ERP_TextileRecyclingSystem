"use client"

// Attendance and finished work per employee for a period, with totals per department.
import { useQuery } from "@tanstack/react-query"
import { CalendarX, Clock, ListChecks, Scale } from "lucide-react"
import { useMemo, useState } from "react"

import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, dateParams } from "@/components/common/date-filter"
import { NameWithAvatar } from "@/components/common/identity"
import { StatCard } from "@/components/common/stat-card"
import { CardsSkeleton, ErrorState } from "@/components/common/states"
import { api } from "@/lib/api"
import { kg, plural } from "@/lib/format"
import type { DepartmentProductivity, Productivity, ProductivityFigures, ProductivityRow } from "@/types/workforce"
import { hours } from "./schemas"

const n = (v: string | number | null | undefined) => Number(v) || 0
const count = (v: number) => <span className="tabular-nums">{v}</span>

/** The figures shared by the employee table and the department table. */
function figureColumns<T extends ProductivityFigures>(): TableColumn<T>[] {
  return [
    { accessorKey: "days_present", header: "Days present", sortFn: "basic", cell: ({ getValue }) => count(getValue<number>()) },
    { accessorKey: "absences", header: "Absences", sortFn: "basic",
      cell: ({ getValue }) => <span className={getValue<number>() ? "font-medium text-danger-fg tabular-nums" : "text-muted-foreground tabular-nums"}>{getValue<number>()}</span> },
    { accessorKey: "late_days", header: "Late days", sortFn: "basic",
      cell: ({ getValue }) => <span className={getValue<number>() ? "text-warning-fg tabular-nums" : "text-muted-foreground tabular-nums"}>{getValue<number>()}</span> },
    { id: "hours_worked", header: "Hours worked", accessorFn: (r) => n(r.hours_worked), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{hours(row.original.hours_worked)}</span> },
    { id: "overtime_hours", header: "Overtime", accessorFn: (r) => n(r.overtime_hours), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{hours(row.original.overtime_hours)}</span> },
    { accessorKey: "tasks_done", header: "Tasks done", sortFn: "basic", cell: ({ getValue }) => count(getValue<number>()) },
    { id: "output_kg", header: "Output", accessorFn: (r) => n(r.output_kg), sortFn: "basic",
      cell: ({ row }) => n(row.original.output_kg) ? <span className="tabular-nums">{kg(row.original.output_kg)}</span> : <span className="text-muted-foreground">—</span> },
    { id: "kg_per_hour", header: "Kg per hour", accessorFn: (r) => n(r.kg_per_hour), sortFn: "basic",
      cell: ({ row }) => row.original.kg_per_hour != null
        ? <span className="font-medium tabular-nums">{hours(row.original.kg_per_hour)}</span> : <span className="text-muted-foreground">—</span> },
  ]
}

export function ProductivityPanel() {
  const [period, setPeriod] = useState<DateFilterValue>({ type: "this_month" })
  const params = dateParams(period)
  const report = useQuery<Productivity>({
    queryKey: ["workforce/productivity", params], queryFn: () => api("workforce/productivity", { params }),
  })

  const employeeColumns = useMemo<TableColumn<ProductivityRow>[]>(() => [
    { accessorKey: "full_name", header: "Employee",
      cell: ({ row }) => <NameWithAvatar name={row.original.full_name} sub={`${row.original.number} · ${row.original.job_role_title}`} /> },
    { accessorKey: "department_name", header: "Department" },
    ...figureColumns<ProductivityRow>(),
  ], [])
  const departmentColumns = useMemo<TableColumn<DepartmentProductivity>[]>(() => [
    { accessorKey: "name", header: "Department", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "employees", header: "Employees", sortFn: "basic", cell: ({ getValue }) => count(getValue<number>()) },
    ...figureColumns<DepartmentProductivity>(),
  ], [])

  const data = report.data
  const t = data?.totals
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DateFilter value={period} onChange={setPeriod} />
        <span className="text-sm text-muted-foreground">Attendance and finished tasks dated in the period</span>
      </div>
      {report.isError ? <ErrorState message={report.error.message} onRetry={() => report.refetch()} />
        : !data || !t ? <CardsSkeleton />
        : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Hours worked" icon={Clock} tone="workforce" value={`${hours(t.hours_worked)} h`} muted={!n(t.hours_worked)}
                hint={`${hours(t.overtime_hours)} h overtime · ${plural(t.days_present, "day")} present`} />
              <StatCard label="Absences" icon={CalendarX} tone={t.absences ? "danger" : "success"} value={t.absences} muted={!t.absences}
                hint={`${plural(t.late_days, "late day")} · ${plural(t.leave_days, "day")} on leave`} />
              <StatCard label="Tasks done" icon={ListChecks} tone="info" value={t.tasks_done} muted={!t.tasks_done}
                hint={`By ${plural(t.employees, "employee")}`} />
              <StatCard label="Output" icon={Scale} tone="success" value={kg(t.output_kg)} muted={!n(t.output_kg)}
                hint={t.kg_per_hour != null ? `${hours(t.kg_per_hour)} kg per hour on tasks with hours` : "Needs tasks with output and hours"} />
            </div>
            <DataTable columns={employeeColumns} data={data.employees} exportName="workforce-productivity"
              searchPlaceholder="Search employee, department…" emptyTitle="No employees"
              initialSorting={[{ id: "hours_worked", desc: true }]} />
            <section className="space-y-3">
              <h2 className="font-heading text-base font-semibold">By department</h2>
              <DataTable columns={departmentColumns} data={data.departments} pageSize={10} emptyTitle="No departments" />
            </section>
          </>
        )}
    </div>
  )
}
