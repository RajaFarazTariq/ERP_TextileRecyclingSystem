"use client"

import { useQuery } from "@tanstack/react-query"
import { CalendarClock, CalendarOff, Check, CheckCircle2, Clock, Play, Plus, UserCheck, Users, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { axisProps, ChartCard, ChartLegend, ChartTooltip, cursorProps, gridProps, yAxisProps } from "@/components/common/chart"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, dateParams } from "@/components/common/date-filter"
import { NameWithAvatar } from "@/components/common/identity"
import { ProgressBar } from "@/components/common/meters"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { useAction, useDelete, useList, useSave } from "@/lib/crud"
import { date, kg, plural } from "@/lib/format"
import type { UserSummary } from "@/types/api"
import type {
  Attendance, Department, Employee, JobRole, LeaveRequest, Shift, TaskAssignment, WorkforceSummary,
} from "@/types/workforce"
import { AttendanceSheetPanel } from "./attendance-sheet"
import { ProductivityPanel } from "./productivity-panel"
import {
  ATTENDANCE_TONES, EMPLOYEE_STATUSES, EMPLOYEE_TONES, LEAVE_TONES, TASK_STATUSES, TASK_TONES, hours, shortTime,
} from "./schemas"
import {
  AttendanceDialog, DepartmentDialog, EmployeeDialog, JobRoleDialog, LeaveDialog, RejectLeaveDialog, ShiftDialog,
  TaskDialog, WORKFORCE_LISTS,
} from "./workforce-forms"

type Tab = "dashboard" | "employees" | "attendance" | "leave" | "tasks" | "productivity" | "setup"
type Editing =
  | { kind: "employee"; record: Employee | null }
  | { kind: "attendance"; record: Attendance | null }
  | { kind: "leave"; record: LeaveRequest | null }
  | { kind: "task"; record: TaskAssignment | null }
  | { kind: "department"; record: Department | null }
  | { kind: "role"; record: JobRole | null }
  | { kind: "shift"; record: Shift | null }
type Deleting = { kind: "employee" | "attendance" | "leave" | "task" | "department" | "role" | "shift"; id: number; label: string }

const ALL = "all"
const dash = <span className="text-muted-foreground">—</span>
const TREND = [
  { key: "Present", color: "var(--success)" }, { key: "Late", color: "var(--warning)" }, { key: "Half day", color: "var(--info)" },
  { key: "Absent", color: "var(--danger)" }, { key: "Leave", color: "var(--muted-foreground)" },
] as const

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })

export function WorkforcePage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [leaveFilter, setLeaveFilter] = useState(ALL)
  const [taskFilter, setTaskFilter] = useState(ALL)
  const [period, setPeriod] = useState<DateFilterValue>({ type: "this_week" })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null)

  const employees = useList<Employee>("workforce/employees")
  const attendance = useList<Attendance>("workforce/attendance", dateParams(period))
  const leave = useList<LeaveRequest>("workforce/leave")
  const tasks = useList<TaskAssignment>("workforce/tasks")
  const departments = useList<Department>("workforce/departments")
  const roles = useList<JobRole>("workforce/job-roles")
  const shifts = useList<Shift>("workforce/shifts")
  const users = useList<UserSummary>("users/list")
  const summary = useQuery<WorkforceSummary>({ queryKey: ["workforce/summary"], queryFn: () => api("workforce/summary") })

  // `mutate` functions are stable, so the table columns below can depend on them
  const { mutate: approveLeave } = useAction("workforce/leave", "approve", { success: "Leave approved.", invalidate: WORKFORCE_LISTS })
  const { mutate: saveTask } = useSave<TaskAssignment>("workforce/tasks", { noun: "Task", invalidate: WORKFORCE_LISTS })
  const removers = {
    employee: useDelete("workforce/employees", { noun: "Employee", invalidate: WORKFORCE_LISTS }),
    attendance: useDelete("workforce/attendance", { noun: "Attendance", invalidate: WORKFORCE_LISTS }),
    leave: useDelete("workforce/leave", { noun: "Leave request", invalidate: WORKFORCE_LISTS }),
    task: useDelete("workforce/tasks", { noun: "Task", invalidate: WORKFORCE_LISTS }),
    department: useDelete("workforce/departments", { noun: "Department", invalidate: WORKFORCE_LISTS }),
    role: useDelete("workforce/job-roles", { noun: "Job role", invalidate: WORKFORCE_LISTS }),
    shift: useDelete("workforce/shifts", { noun: "Shift", invalidate: WORKFORCE_LISTS }),
  }

  const employeeColumns = useMemo<TableColumn<Employee>[]>(() => [
    // Name and code together, so the search box finds either
    { id: "full_name", header: "Employee", accessorFn: (r) => `${r.full_name} ${r.number}`,
      cell: ({ row }) => <NameWithAvatar name={row.original.full_name} sub={row.original.number} /> },
    { accessorKey: "department_name", header: "Department" },
    { accessorKey: "job_role_title", header: "Job role" },
    { accessorKey: "shift_name", header: "Shift", cell: ({ getValue }) => getValue<string | null>() ?? dash },
    { accessorKey: "employment_type", header: "Type" },
    { accessorKey: "phone", header: "Phone", cell: ({ getValue }) => getValue<string>() || dash },
    { id: "joined_on", header: "Joined", accessorFn: (r) => new Date(r.joined_on), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.joined_on)}</span> },
    { accessorKey: "status", header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} tone={EMPLOYEE_TONES[row.original.status]} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions onEdit={() => setEditing({ kind: "employee", record: row.original })}
        onDelete={() => setDeleting({ kind: "employee", id: row.original.id, label: row.original.full_name })} /> },
  ], [])

  const attendanceColumns = useMemo<TableColumn<Attendance>[]>(() => [
    { id: "date", header: "Date", accessorFn: (r) => new Date(r.date), sortFn: "datetime", cell: ({ row }) => date(row.original.date) },
    { accessorKey: "employee_name", header: "Employee",
      cell: ({ row }) => <NameWithAvatar name={row.original.employee_name} sub={`${row.original.employee_number} · ${row.original.department_name}`} /> },
    { accessorKey: "shift_name", header: "Shift", cell: ({ getValue }) => getValue<string | null>() ?? dash },
    { accessorKey: "status", header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} tone={ATTENDANCE_TONES[row.original.status]} /> },
    { id: "check_in", header: "In", accessorFn: (r) => shortTime(r.check_in), cell: ({ getValue }) => <span className="tabular-nums">{getValue<string>() || "—"}</span> },
    { id: "check_out", header: "Out", accessorFn: (r) => shortTime(r.check_out), cell: ({ getValue }) => <span className="tabular-nums">{getValue<string>() || "—"}</span> },
    { id: "hours_worked", header: "Hours", accessorFn: (r) => Number(r.hours_worked), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{hours(row.original.hours_worked)}</span> },
    { id: "overtime_hours", header: "Overtime", accessorFn: (r) => Number(r.overtime_hours), sortFn: "basic",
      cell: ({ row }) => Number(row.original.overtime_hours) ? <span className="tabular-nums">{hours(row.original.overtime_hours)}</span> : dash },
    { accessorKey: "notes", header: "Notes",
      cell: ({ getValue }) => getValue<string>() ? <span className="block max-w-56 truncate" title={getValue<string>()}>{getValue<string>()}</span> : dash },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions onEdit={() => setEditing({ kind: "attendance", record: row.original })}
        onDelete={() => setDeleting({ kind: "attendance", id: row.original.id, label: `the attendance of ${row.original.employee_name} on ${date(row.original.date)}` })} /> },
  ], [])

  const leaveColumns = useMemo<TableColumn<LeaveRequest>[]>(() => [
    { accessorKey: "employee_name", header: "Employee",
      cell: ({ row }) => <NameWithAvatar name={row.original.employee_name} sub={`${row.original.employee_number} · ${row.original.department_name}`} /> },
    { accessorKey: "leave_type", header: "Type" },
    { id: "start_date", header: "From", accessorFn: (r) => new Date(r.start_date), sortFn: "datetime", cell: ({ row }) => date(row.original.start_date) },
    { id: "end_date", header: "To", accessorFn: (r) => new Date(r.end_date), sortFn: "datetime", cell: ({ row }) => date(row.original.end_date) },
    { accessorKey: "days", header: "Days", sortFn: "basic", cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
    { accessorKey: "reason", header: "Reason",
      cell: ({ getValue }) => getValue<string>() ? <span className="block max-w-64 truncate" title={getValue<string>()}>{getValue<string>()}</span> : dash },
    { accessorKey: "status", header: "Status",
      cell: ({ row }) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge status={row.original.status} tone={LEAVE_TONES[row.original.status]} />
          {row.original.decided_by_name && <span className="text-xs text-muted-foreground">by {row.original.decided_by_name}</span>}
        </span>
      ) },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const l = row.original
        const pending = l.status === "Pending"
        return <RowActions
          extra={pending ? [
            { label: "Approve", icon: <Check className="size-4" />, onSelect: () => approveLeave({ id: l.id }) },
            { label: "Reject", icon: <X className="size-4" />, onSelect: () => setRejecting(l) },
          ] : []}
          onEdit={pending ? () => setEditing({ kind: "leave", record: l }) : undefined}
          onDelete={() => setDeleting({ kind: "leave", id: l.id, label: `the leave request of ${l.employee_name}` })} />
      } },
  ], [approveLeave])

  const taskColumns = useMemo<TableColumn<TaskAssignment>[]>(() => [
    { accessorKey: "title", header: "Task",
      cell: ({ row }) => (
        <span className="block max-w-72">
          <span className="block truncate font-medium" title={row.original.description || row.original.title}>{row.original.title}</span>
          {row.original.reference && <span className="block truncate text-xs text-muted-foreground">{row.original.reference}</span>}
        </span>
      ) },
    { accessorKey: "employee_name", header: "Employee", cell: ({ row }) => <NameWithAvatar name={row.original.employee_name} sub={row.original.employee_number} /> },
    { id: "date", header: "Date", accessorFn: (r) => new Date(r.date), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{date(row.original.date)}</span> },
    { accessorKey: "area", header: "Area", cell: ({ getValue }) => getValue<string>() || dash },
    { id: "hours_spent", header: "Hours", accessorFn: (r) => Number(r.hours_spent) || 0, sortFn: "basic",
      cell: ({ row }) => row.original.hours_spent != null ? <span className="tabular-nums">{hours(row.original.hours_spent)}</span> : dash },
    { id: "output_kg", header: "Output", accessorFn: (r) => Number(r.output_kg) || 0, sortFn: "basic",
      cell: ({ row }) => row.original.output_kg != null ? <span className="tabular-nums">{kg(row.original.output_kg)}</span> : dash },
    { accessorKey: "status", header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} tone={TASK_TONES[row.original.status]} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const t = row.original
        const extra = []
        if (t.status === "Assigned") extra.push({ label: "Start", icon: <Play className="size-4" />, onSelect: () => saveTask({ id: t.id, body: { status: "In progress" } }) })
        if (t.status !== "Done") extra.push({ label: "Mark as done", icon: <CheckCircle2 className="size-4" />, onSelect: () => saveTask({ id: t.id, body: { status: "Done" } }) })
        return <RowActions extra={extra} onEdit={() => setEditing({ kind: "task", record: t })}
          onDelete={() => setDeleting({ kind: "task", id: t.id, label: t.title })} />
      } },
  ], [saveTask])

  const departmentColumns = useMemo<TableColumn<Department>[]>(() => [
    { accessorKey: "name", header: "Department", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "employees", header: "Employees", sortFn: "basic", cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
    { id: "is_active", header: "Status", accessorFn: (r) => (r.is_active ? "In use" : "Not in use"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "In use" : "Not in use"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions onEdit={() => setEditing({ kind: "department", record: row.original })}
        onDelete={() => setDeleting({ kind: "department", id: row.original.id, label: row.original.name })} /> },
  ], [])

  const roleColumns = useMemo<TableColumn<JobRole>[]>(() => [
    { accessorKey: "title", header: "Job role", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "department_name", header: "Department", cell: ({ getValue }) => getValue<string | null>() ?? <span className="text-muted-foreground">Any</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions onEdit={() => setEditing({ kind: "role", record: row.original })}
        onDelete={() => setDeleting({ kind: "role", id: row.original.id, label: row.original.title })} /> },
  ], [])

  const shiftColumns = useMemo<TableColumn<Shift>[]>(() => [
    { accessorKey: "name", header: "Shift", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "time", header: "Time", accessorFn: (r) => `${shortTime(r.start_time)} – ${shortTime(r.end_time)}`,
      cell: ({ getValue }) => <span className="whitespace-nowrap tabular-nums">{getValue<string>()}</span> },
    { id: "hours", header: "Hours", accessorFn: (r) => Number(r.hours), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{hours(row.original.hours)}</span> },
    { id: "is_active", header: "Status", accessorFn: (r) => (r.is_active ? "In use" : "Not in use"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "In use" : "Not in use"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => <RowActions onEdit={() => setEditing({ kind: "shift", record: row.original })}
        onDelete={() => setDeleting({ kind: "shift", id: row.original.id, label: row.original.name })} /> },
  ], [])

  const addFor: Record<Tab, { label: string; open: () => void } | null> = {
    dashboard: { label: "Add employee", open: () => setEditing({ kind: "employee", record: null }) },
    employees: { label: "Add employee", open: () => setEditing({ kind: "employee", record: null }) },
    attendance: { label: "Add one record", open: () => setEditing({ kind: "attendance", record: null }) },
    leave: { label: "New leave request", open: () => setEditing({ kind: "leave", record: null }) },
    tasks: { label: "Assign task", open: () => setEditing({ kind: "task", record: null }) },
    productivity: null,
    setup: null,
  }

  const core = [employees, summary]
  const loadError = core.find((q) => q.isError)
  const s = summary.data
  const add = addFor[tab]
  const staff = employees.data ?? []
  const takenUsers = useMemo(() => new Set((employees.data ?? []).flatMap((e) => (e.user ? [e.user] : []))), [employees.data])
  const shownEmployees = staff.filter((e) => statusFilter === ALL || e.status === statusFilter)
  const shownLeave = (leave.data ?? []).filter((l) => leaveFilter === ALL || l.status === leaveFilter)
  const shownTasks = (tasks.data ?? []).filter((t) => taskFilter === ALL || t.status === taskFilter)
  const pendingLeave = (leave.data ?? []).filter((l) => l.status === "Pending")
  const trend = (s?.trend ?? []).map((t) => ({ ...t, day: dayLabel(t.date) }))
  const biggest = Math.max(1, ...(s?.by_department ?? []).map((d) => d.employees))

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Workforce" icon="workforce"
        description="Employees, daily attendance, leave, task assignments and productivity."
        actions={add && <Button onClick={add.open}><Plus className="size-4" /> {add.label}</Button>} />

      {loadError ? (
        <ErrorState message={loadError.error!.message} onRetry={() => core.forEach((q) => q.refetch())} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="leave">Leave</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="productivity">Productivity</TabsTrigger>
            <TabsTrigger value="setup">Setup</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4 space-y-6">
            {!s ? <CardsSkeleton /> : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Active employees" icon={Users} tone="workforce" value={s.active_employees} muted={s.active_employees === 0}
                    hint={s.employees > s.active_employees ? `${s.employees - s.active_employees} more on long leave` : `In ${plural(s.by_department.length, "department")}`} />
                  <StatCard label="Present today" icon={UserCheck} tone="success" value={s.present_today + s.late_today} muted={s.present_today + s.late_today === 0}
                    hint={`${s.late_today} late · ${s.absent_today} absent${s.not_marked_today ? ` · ${s.not_marked_today} not marked` : ""}`} />
                  <StatCard label="On leave today" icon={CalendarOff} tone={s.pending_leave_requests ? "warning" : "info"} value={s.on_leave_today} muted={s.on_leave_today === 0}
                    hint={s.pending_leave_requests ? `${plural(s.pending_leave_requests, "request")} waiting for a decision` : "No requests waiting"} />
                  <StatCard label="Hours worked, this month" icon={Clock} tone="info" value={`${hours(s.hours_this_month)} h`} muted={!Number(s.hours_this_month)}
                    hint={`${hours(s.overtime_this_month)} h overtime · ${plural(s.open_tasks, "open task")}`} />
                </div>

                <div className="grid gap-4 lg:grid-cols-5">
                  <ChartCard className="lg:col-span-3" title="Attendance" description="Last 7 days" contentClassName="h-64"
                    actions={<ChartLegend items={TREND.map((t) => ({ label: t.key, color: t.color }))} />}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trend} margin={{ left: 0, right: 8, top: 8 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="day" {...axisProps} />
                        <YAxis {...yAxisProps} allowDecimals={false} />
                        <Tooltip cursor={cursorProps} content={<ChartTooltip />} />
                        {TREND.map((t, i) => (
                          <Bar key={t.key} dataKey={t.key} stackId="a" isAnimationActive={false} fill={t.color} maxBarSize={48}
                            radius={i === TREND.length - 1 ? [6, 6, 0, 0] : undefined} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <Card className="animate-rise lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Employees by department</CardTitle>
                      <CardDescription className="mt-0.5">People who have left are not counted</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3.5">
                      {s.by_department.length ? s.by_department.map((d) => (
                        <div key={d.department}>
                          <div className="mb-1.5 flex justify-between gap-2 text-sm">
                            <span className="truncate font-medium">{d.name}</span>
                            <span className="shrink-0 text-muted-foreground tabular-nums">{d.employees}</span>
                          </div>
                          <ProgressBar value={(d.employees / biggest) * 100} size="sm" tone="workforce" label={`${d.name} employees`} />
                        </div>
                      )) : <EmptyState icon={Users} title="No employees yet" description="Add departments and job roles in Setup, then add employees." />}
                    </CardContent>
                  </Card>
                </div>

                <Card className="animate-rise">
                  <CardHeader>
                    <CardTitle>Leave requests waiting</CardTitle>
                    <CardDescription className="mt-0.5">Approved leave shows as “Leave” on the attendance sheet</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pendingLeave.length ? pendingLeave.slice(0, 6).map((l) => (
                      <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                        <div className="min-w-0 flex-1 basis-48">
                          <p className="truncate text-sm font-medium">{l.employee_name} <span className="font-normal text-muted-foreground">{l.department_name}</span></p>
                          <p className="truncate text-xs text-muted-foreground" title={l.reason}>
                            {l.leave_type} · {date(l.start_date)}{l.days > 1 ? ` to ${date(l.end_date)}` : ""} · {plural(l.days, "day")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setRejecting(l)}><X className="size-3.5" /> Reject</Button>
                          <Button size="sm" onClick={() => approveLeave({ id: l.id })}><Check className="size-3.5" /> Approve</Button>
                        </div>
                      </div>
                    )) : (
                      <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <CheckCircle2 className="size-4 text-success-fg" aria-hidden /> No leave request is waiting.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="employees" className="mt-4">
            {employees.isPending ? <TableSkeleton columns={8} /> : (
              <DataTable columns={employeeColumns} data={shownEmployees} exportName="employees"
                searchPlaceholder="Search name, code, department…" emptyTitle="No employees"
                emptyDescription="Add one with “Add employee”. Departments and job roles are set up in Setup."
                filters={statusFilter !== ALL ? [{ label: `Status: ${statusFilter}`, onClear: () => setStatusFilter(ALL) }] : []}
                toolbar={
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[160px]" aria-label="Employee status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All statuses</SelectItem>
                      {EMPLOYEE_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                    </SelectContent>
                  </Select>
                } />
            )}
          </TabsContent>

          <TabsContent value="attendance" className="mt-4 space-y-8">
            <AttendanceSheetPanel shifts={shifts.data ?? []} />
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                <CalendarClock className="size-4 text-muted-foreground" aria-hidden /> Attendance records
              </h2>
              {attendance.isError ? <ErrorState message={attendance.error.message} onRetry={() => attendance.refetch()} />
                : attendance.isPending ? <TableSkeleton columns={8} /> : (
                  <DataTable columns={attendanceColumns} data={attendance.data} exportName="attendance"
                    searchPlaceholder="Search employee, status…" emptyTitle="No attendance in this period"
                    emptyDescription="Mark the sheet above and save it, or choose another period."
                    initialSorting={[{ id: "date", desc: true }]}
                    toolbar={<DateFilter value={period} onChange={setPeriod} />} />
                )}
            </section>
          </TabsContent>

          <TabsContent value="leave" className="mt-4">
            {leave.isError ? <ErrorState message={leave.error.message} onRetry={() => leave.refetch()} />
              : leave.isPending ? <TableSkeleton columns={7} /> : (
                <DataTable columns={leaveColumns} data={shownLeave} exportName="leave-requests"
                  searchPlaceholder="Search employee, type, reason…" emptyTitle="No leave requests"
                  emptyDescription="Record one with “New leave request”, then approve or reject it."
                  initialSorting={[{ id: "start_date", desc: true }]}
                  filters={leaveFilter !== ALL ? [{ label: `Status: ${leaveFilter}`, onClear: () => setLeaveFilter(ALL) }] : []}
                  toolbar={
                    <Select value={leaveFilter} onValueChange={setLeaveFilter}>
                      <SelectTrigger className="h-9 w-[160px]" aria-label="Leave status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All statuses</SelectItem>
                        {(["Pending", "Approved", "Rejected"] as const).map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  } />
              )}
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            {tasks.isError ? <ErrorState message={tasks.error.message} onRetry={() => tasks.refetch()} />
              : tasks.isPending ? <TableSkeleton columns={7} /> : (
                <DataTable columns={taskColumns} data={shownTasks} exportName="task-assignments"
                  searchPlaceholder="Search task, employee, area…" emptyTitle="No tasks"
                  emptyDescription="Give someone work with “Assign task”."
                  initialSorting={[{ id: "date", desc: true }]}
                  filters={taskFilter !== ALL ? [{ label: `Status: ${taskFilter}`, onClear: () => setTaskFilter(ALL) }] : []}
                  toolbar={
                    <Select value={taskFilter} onValueChange={setTaskFilter}>
                      <SelectTrigger className="h-9 w-[160px]" aria-label="Task status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All statuses</SelectItem>
                        {TASK_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  } />
              )}
          </TabsContent>

          <TabsContent value="productivity" className="mt-4">
            <ProductivityPanel />
          </TabsContent>

          <TabsContent value="setup" className="mt-4 space-y-8">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-base font-semibold">Departments</h2>
                <Button variant="outline" size="sm" onClick={() => setEditing({ kind: "department", record: null })}><Plus className="size-4" /> New department</Button>
              </div>
              {departments.isError ? <ErrorState message={departments.error.message} onRetry={() => departments.refetch()} />
                : departments.isPending ? <TableSkeleton columns={3} /> : (
                  <DataTable columns={departmentColumns} data={departments.data} pageSize={10} emptyTitle="No departments"
                    emptyDescription="e.g. Warehouse, Sorting, Drying." />
                )}
            </section>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-base font-semibold">Job roles</h2>
                <Button variant="outline" size="sm" onClick={() => setEditing({ kind: "role", record: null })}><Plus className="size-4" /> New job role</Button>
              </div>
              {roles.isError ? <ErrorState message={roles.error.message} onRetry={() => roles.refetch()} />
                : roles.isPending ? <TableSkeleton columns={2} /> : (
                  <DataTable columns={roleColumns} data={roles.data} pageSize={10} emptyTitle="No job roles"
                    emptyDescription="e.g. Sorter, Tank operator." />
                )}
            </section>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-base font-semibold">Shifts</h2>
                <Button variant="outline" size="sm" onClick={() => setEditing({ kind: "shift", record: null })}><Plus className="size-4" /> New shift</Button>
              </div>
              {shifts.isError ? <ErrorState message={shifts.error.message} onRetry={() => shifts.refetch()} />
                : shifts.isPending ? <TableSkeleton columns={4} /> : (
                  <DataTable columns={shiftColumns} data={shifts.data} pageSize={10} emptyTitle="No shifts"
                    emptyDescription="e.g. Morning 06:00 to 14:00." />
                )}
            </section>
          </TabsContent>
        </Tabs>
      )}

      <EmployeeDialog open={editing?.kind === "employee"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "employee" ? editing.record : null} departments={departments.data ?? []}
        roles={roles.data ?? []} shifts={shifts.data ?? []} users={users.data ?? []} takenUsers={takenUsers} />
      <AttendanceDialog open={editing?.kind === "attendance"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "attendance" ? editing.record : null} employees={staff} shifts={shifts.data ?? []} />
      <LeaveDialog open={editing?.kind === "leave"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "leave" ? editing.record : null} employees={staff} />
      <TaskDialog open={editing?.kind === "task"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "task" ? editing.record : null} employees={staff} />
      <DepartmentDialog open={editing?.kind === "department"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "department" ? editing.record : null} />
      <JobRoleDialog open={editing?.kind === "role"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "role" ? editing.record : null} departments={departments.data ?? []} />
      <ShiftDialog open={editing?.kind === "shift"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "shift" ? editing.record : null} />
      <RejectLeaveDialog leave={rejecting} onOpenChange={(o) => !o && setRejecting(null)} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.label}?`}
        description={deleting?.kind === "employee"
          ? "An employee with attendance, leave or tasks can't be deleted. Set their status to “Left” instead."
          : "It will be removed. Records that depend on it can't be deleted."}
        onConfirm={async () => {
          if (deleting) await removers[deleting.kind].mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
