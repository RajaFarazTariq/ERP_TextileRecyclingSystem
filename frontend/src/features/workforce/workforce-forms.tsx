"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { Field, FieldGroup, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { today } from "@/features/procurement/schemas"
import { useAction, useSave } from "@/lib/crud"
import { displayName, plural } from "@/lib/format"
import { applyServerErrors } from "@/lib/forms"
import type { UserSummary } from "@/types/api"
import type { Attendance, Department, Employee, JobRole, LeaveRequest, Shift, TaskAssignment } from "@/types/workforce"
import {
  ATTENDANCE_STATUSES, type AttendanceForm, type DepartmentForm, EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, type EmployeeForm,
  type JobRoleForm, LEAVE_TYPES, type LeaveForm, type ShiftForm, TASK_AREAS, TASK_STATUSES, type TaskForm,
  attendanceSchema, departmentSchema, employeeSchema, hours, hoursBetween, jobRoleSchema, leaveDays, leaveSchema,
  notAtWork, shiftSchema, shortTime, taskSchema,
} from "./schemas"

// Every list and report of the module: most changes show up in more than one tab
export const WORKFORCE_LISTS = [
  ["workforce/employees"], ["workforce/attendance"], ["workforce/attendance/sheet"], ["workforce/leave"],
  ["workforce/tasks"], ["workforce/departments"], ["workforce/job-roles"], ["workforce/shifts"],
  ["workforce/summary"], ["workforce/productivity"],
]

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

const orNull = (v: string) => (v ? v : null)
const idOrNull = (v: string) => (v ? Number(v) : null)
const YES_NO = [{ value: "yes", label: "In use" }, { value: "no", label: "Not in use" }]

export const shiftLabel = (s: Shift) => `${s.name} (${shortTime(s.start_time)} – ${shortTime(s.end_time)})`
const employeeOptions = (employees: Employee[], keep?: number | null) =>
  employees.filter((e) => e.status !== "Left" || e.id === keep)
    .map((e) => ({ value: String(e.id), label: `${e.full_name} · ${e.number}` }))

// ─── Department ─────────────────────────────────────────────────────────────

export function DepartmentDialog(props: DialogProps<Department>) {
  return props.open ? <DepartmentDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function DepartmentDialogBody({ open, onOpenChange, record }: DialogProps<Department>) {
  const save = useSave<Department>("workforce/departments", { noun: "Department", invalidate: WORKFORCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<DepartmentForm>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: record?.name ?? "", description: record?.description ?? "", is_active: record?.is_active === false ? "no" : "yes" },
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
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New department"}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="department-name" label="Name" error={errors.name?.message}>
        <Input id="department-name" placeholder="e.g. Sorting" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <Field id="department-active" label="Status">
        <Controller control={form.control} name="is_active" render={({ field }) => (
          <SelectField id="department-active" value={field.value} onChange={field.onChange} placeholder="Select status" options={YES_NO} />
        )} />
      </Field>
      <Field id="department-description" label="Description">
        <Textarea id="department-description" rows={2} {...form.register("description")} />
      </Field>
    </FormDialog>
  )
}

// ─── Job role ───────────────────────────────────────────────────────────────

type JobRoleDialogProps = DialogProps<JobRole> & { departments: Department[] }

export function JobRoleDialog(props: JobRoleDialogProps) {
  return props.open ? <JobRoleDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function JobRoleDialogBody({ open, onOpenChange, record, departments }: JobRoleDialogProps) {
  const save = useSave<JobRole>("workforce/job-roles", { noun: "Job role", invalidate: WORKFORCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<JobRoleForm>({
    resolver: zodResolver(jobRoleSchema),
    defaultValues: { title: record?.title ?? "", department: record?.department ? String(record.department) : "", description: record?.description ?? "" },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, department: idOrNull(values.department) } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.title}` : "New job role"}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="role-title" label="Title" error={errors.title?.message}>
        <Input id="role-title" placeholder="e.g. Tank operator" aria-invalid={!!errors.title} {...form.register("title")} />
      </Field>
      <Field id="role-department" label="Department" hint="Leave empty for a role found in every department">
        <Controller control={form.control} name="department" render={({ field }) => (
          <SelectField id="role-department" value={field.value} onChange={field.onChange} placeholder="Any department" allowNone="Any department"
            options={departments.map((d) => ({ value: String(d.id), label: d.name }))} />
        )} />
      </Field>
      <Field id="role-description" label="Description">
        <Textarea id="role-description" rows={2} {...form.register("description")} />
      </Field>
    </FormDialog>
  )
}

// ─── Shift ──────────────────────────────────────────────────────────────────

export function ShiftDialog(props: DialogProps<Shift>) {
  return props.open ? <ShiftDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function ShiftDialogBody({ open, onOpenChange, record }: DialogProps<Shift>) {
  const save = useSave<Shift>("workforce/shifts", { noun: "Shift", invalidate: WORKFORCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      name: record?.name ?? "", start_time: shortTime(record?.start_time), end_time: shortTime(record?.end_time),
      is_active: record?.is_active === false ? "no" : "yes",
    },
  })
  const { errors, isSubmitting } = form.formState
  const [start, end] = useWatch({ control: form.control, name: ["start_time", "end_time"] })
  const length = start !== end ? hoursBetween(start, end) : null

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
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New shift"}
      description="A shift may end on the next day, e.g. 22:00 to 06:00."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="shift-name" label="Name" error={errors.name?.message}>
        <Input id="shift-name" placeholder="e.g. Morning" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="shift-start" label="Starts" error={errors.start_time?.message}>
          <Input id="shift-start" type="time" aria-invalid={!!errors.start_time} {...form.register("start_time")} />
        </Field>
        <Field id="shift-end" label="Ends" error={errors.end_time?.message}
          hint={length != null ? `${hours(length)} hours${end < start ? ", ends the next day" : ""}` : undefined}>
          <Input id="shift-end" type="time" aria-invalid={!!errors.end_time} {...form.register("end_time")} />
        </Field>
      </div>
      <Field id="shift-active" label="Status">
        <Controller control={form.control} name="is_active" render={({ field }) => (
          <SelectField id="shift-active" value={field.value} onChange={field.onChange} placeholder="Select status" options={YES_NO} />
        )} />
      </Field>
    </FormDialog>
  )
}

// ─── Employee ───────────────────────────────────────────────────────────────

type EmployeeDialogProps = DialogProps<Employee> & {
  departments: Department[]
  roles: JobRole[]
  shifts: Shift[]
  users: UserSummary[]
  /** Logins already linked to an employee */
  takenUsers: Set<number>
}

export function EmployeeDialog(props: EmployeeDialogProps) {
  return props.open ? <EmployeeDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function EmployeeDialogBody({ open, onOpenChange, record, departments, roles, shifts, users, takenUsers }: EmployeeDialogProps) {
  const save = useSave<Employee>("workforce/employees", { noun: "Employee", invalidate: WORKFORCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      full_name: record?.full_name ?? "",
      department: record ? String(record.department) : "",
      job_role: record ? String(record.job_role) : "",
      shift: record?.shift ? String(record.shift) : "",
      user: record?.user ? String(record.user) : "",
      phone: record?.phone ?? "",
      cnic: record?.cnic ?? "",
      address: record?.address ?? "",
      emergency_contact: record?.emergency_contact ?? "",
      joined_on: record?.joined_on ?? today(),
      employment_type: record?.employment_type ?? "Permanent",
      status: record?.status ?? "Active",
      left_on: record?.left_on ?? "",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const [department, status] = useWatch({ control: form.control, name: ["department", "status"] })
  // Roles of the chosen department, plus roles that belong to no department
  const roleOptions = roles.filter((r) => !department || r.department === null || String(r.department) === department || r.id === record?.job_role)

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          department: Number(values.department),
          job_role: Number(values.job_role),
          shift: idOrNull(values.shift),
          user: idOrNull(values.user),
          left_on: values.status === "Left" ? orNull(values.left_on) : null,
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.full_name}` : "Add employee"}
      description={record ? `Employee code ${record.number}` : "The employee code is given when you save."}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <FieldGroup title="Job">
        <Field id="employee-name" label="Full name" error={errors.full_name?.message}>
          <Input id="employee-name" aria-invalid={!!errors.full_name} {...form.register("full_name")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="employee-department" label="Department" error={errors.department?.message}>
            <Controller control={form.control} name="department" render={({ field }) => (
              <SelectField id="employee-department" value={field.value} onChange={field.onChange} invalid={!!errors.department} placeholder="Select department"
                options={departments.filter((d) => d.is_active || d.id === record?.department).map((d) => ({ value: String(d.id), label: d.name }))} />
            )} />
          </Field>
          <Field id="employee-role" label="Job role" error={errors.job_role?.message}>
            <Controller control={form.control} name="job_role" render={({ field }) => (
              <SelectField id="employee-role" value={field.value} onChange={field.onChange} invalid={!!errors.job_role} placeholder="Select job role"
                options={roleOptions.map((r) => ({ value: String(r.id), label: r.title }))} />
            )} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="employee-shift" label="Usual shift">
            <Controller control={form.control} name="shift" render={({ field }) => (
              <SelectField id="employee-shift" value={field.value} onChange={field.onChange} placeholder="No fixed shift" allowNone="No fixed shift"
                options={shifts.filter((s) => s.is_active || s.id === record?.shift).map((s) => ({ value: String(s.id), label: shiftLabel(s) }))} />
            )} />
          </Field>
          <Field id="employee-type" label="Employment type">
            <Controller control={form.control} name="employment_type" render={({ field }) => (
              <SelectField id="employee-type" value={field.value} onChange={field.onChange} placeholder="Select type"
                options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t }))} />
            )} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="employee-joined" label="Joined on" error={errors.joined_on?.message}>
            <Input id="employee-joined" type="date" aria-invalid={!!errors.joined_on} {...form.register("joined_on")} />
          </Field>
          <Field id="employee-status" label="Status">
            <Controller control={form.control} name="status" render={({ field }) => (
              <SelectField id="employee-status" value={field.value} onChange={field.onChange} placeholder="Select status"
                options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: s }))} />
            )} />
          </Field>
        </div>
        {status === "Left" && (
          <Field id="employee-left" label="Left on" hint="Leave empty to use today" error={errors.left_on?.message}>
            <Input id="employee-left" type="date" aria-invalid={!!errors.left_on} {...form.register("left_on")} />
          </Field>
        )}
      </FieldGroup>

      <FieldGroup title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="employee-phone" label="Phone" error={errors.phone?.message}>
            <Input id="employee-phone" inputMode="tel" {...form.register("phone")} />
          </Field>
          <Field id="employee-cnic" label="CNIC / national ID" hint="Optional" error={errors.cnic?.message}>
            <Input id="employee-cnic" placeholder="00000-0000000-0" {...form.register("cnic")} />
          </Field>
        </div>
        <Field id="employee-address" label="Address">
          <Textarea id="employee-address" rows={2} {...form.register("address")} />
        </Field>
        <Field id="employee-emergency" label="Emergency contact" hint="Name, relation and phone" error={errors.emergency_contact?.message}>
          <Input id="employee-emergency" {...form.register("emergency_contact")} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Other">
        <Field id="employee-user" label="Login" hint="Only for staff who sign in to this system" error={errors.user?.message}>
          <Controller control={form.control} name="user" render={({ field }) => (
            <SelectField id="employee-user" value={field.value} onChange={field.onChange} invalid={!!errors.user} placeholder="No login" allowNone="No login"
              options={users.filter((u) => !takenUsers.has(u.id) || u.id === record?.user)
                .map((u) => ({ value: String(u.id), label: `${displayName(u.username)} (${u.username})` }))} />
          )} />
        </Field>
        <Field id="employee-notes" label="Notes">
          <Textarea id="employee-notes" rows={2} {...form.register("notes")} />
        </Field>
      </FieldGroup>
    </FormDialog>
  )
}

// ─── One attendance record ──────────────────────────────────────────────────

type AttendanceDialogProps = DialogProps<Attendance> & { employees: Employee[]; shifts: Shift[] }

export function AttendanceDialog(props: AttendanceDialogProps) {
  return props.open ? <AttendanceDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function AttendanceDialogBody({ open, onOpenChange, record, employees, shifts }: AttendanceDialogProps) {
  const save = useSave<Attendance>("workforce/attendance", { noun: "Attendance", invalidate: WORKFORCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<AttendanceForm>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      employee: record ? String(record.employee) : "",
      date: record?.date ?? today(),
      shift: record?.shift ? String(record.shift) : "",
      status: record?.status ?? "Present",
      check_in: shortTime(record?.check_in),
      check_out: shortTime(record?.check_out),
      hours_worked: record && Number(record.hours_worked) ? String(Number(record.hours_worked)) : "",
      overtime_hours: record && Number(record.overtime_hours) ? String(Number(record.overtime_hours)) : "",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting, dirtyFields } = form.formState
  const [status, checkIn, checkOut] = useWatch({ control: form.control, name: ["status", "check_in", "check_out"] })
  const away = notAtWork(status)
  const computed = hoursBetween(checkIn, checkOut)

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    // Hours the user didn't touch follow the times; hours typed by hand are sent as they are
    const typed = dirtyFields.hours_worked || (!dirtyFields.check_in && !dirtyFields.check_out)
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          employee: Number(values.employee),
          shift: idOrNull(values.shift),
          check_in: away ? null : orNull(values.check_in),
          check_out: away ? null : orNull(values.check_out),
          hours_worked: !away && typed ? orNull(values.hours_worked) : null,
          overtime_hours: away ? "0" : values.overtime_hours || "0",
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit attendance: ${record.employee_name}` : "Add attendance"}
      description="One record per employee per day. Use the sheet to mark everyone at once."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="attendance-employee" label="Employee" error={errors.employee?.message}>
        <Controller control={form.control} name="employee" render={({ field }) => (
          <SelectField id="attendance-employee" value={field.value} onChange={field.onChange} invalid={!!errors.employee} disabled={!!record}
            placeholder="Select employee" options={employeeOptions(employees, record?.employee)} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="attendance-date" label="Date" error={errors.date?.message}>
          <Input id="attendance-date" type="date" max={today()} aria-invalid={!!errors.date} {...form.register("date")} />
        </Field>
        <Field id="attendance-status" label="Status">
          <Controller control={form.control} name="status" render={({ field }) => (
            <SelectField id="attendance-status" value={field.value} onChange={field.onChange} placeholder="Select status"
              options={ATTENDANCE_STATUSES.map((s) => ({ value: s, label: s }))} />
          )} />
        </Field>
      </div>
      <Field id="attendance-shift" label="Shift">
        <Controller control={form.control} name="shift" render={({ field }) => (
          <SelectField id="attendance-shift" value={field.value} onChange={field.onChange} placeholder="No shift" allowNone="No shift"
            options={shifts.filter((s) => s.is_active || s.id === record?.shift).map((s) => ({ value: String(s.id), label: shiftLabel(s) }))} />
        )} />
      </Field>
      {!away && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="attendance-in" label="Check-in" error={errors.check_in?.message}>
              <Input id="attendance-in" type="time" aria-invalid={!!errors.check_in} {...form.register("check_in")} />
            </Field>
            <Field id="attendance-out" label="Check-out" error={errors.check_out?.message}>
              <Input id="attendance-out" type="time" {...form.register("check_out")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="attendance-hours" label="Hours worked" error={errors.hours_worked?.message}
              hint={computed != null ? `${hours(computed)} from the times. Type a number to override.` : "Worked out from the times, or type them"}>
              <Input id="attendance-hours" inputMode="decimal" aria-invalid={!!errors.hours_worked} {...form.register("hours_worked")} />
            </Field>
            <Field id="attendance-overtime" label="Overtime hours" error={errors.overtime_hours?.message}>
              <Input id="attendance-overtime" inputMode="decimal" aria-invalid={!!errors.overtime_hours} {...form.register("overtime_hours")} />
            </Field>
          </div>
        </>
      )}
      <Field id="attendance-notes" label="Notes" error={errors.notes?.message}>
        <Input id="attendance-notes" {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Leave request ──────────────────────────────────────────────────────────

type LeaveDialogProps = DialogProps<LeaveRequest> & { employees: Employee[] }

export function LeaveDialog(props: LeaveDialogProps) {
  return props.open ? <LeaveDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function LeaveDialogBody({ open, onOpenChange, record, employees }: LeaveDialogProps) {
  const save = useSave<LeaveRequest>("workforce/leave", { noun: "Leave request", invalidate: WORKFORCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      employee: record ? String(record.employee) : "",
      leave_type: record?.leave_type ?? "Annual",
      start_date: record?.start_date ?? today(),
      end_date: record?.end_date ?? today(),
      reason: record?.reason ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const [start, end] = useWatch({ control: form.control, name: ["start_date", "end_date"] })
  const days = leaveDays(start, end)

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, employee: Number(values.employee) } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit leave request" : "New leave request"}
      description="A request waits for approval. Approved leave shows as “Leave” on the attendance sheet for those days."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="leave-employee" label="Employee" error={errors.employee?.message}>
        <Controller control={form.control} name="employee" render={({ field }) => (
          <SelectField id="leave-employee" value={field.value} onChange={field.onChange} invalid={!!errors.employee}
            placeholder="Select employee" options={employeeOptions(employees, record?.employee)} />
        )} />
      </Field>
      <Field id="leave-type" label="Leave type">
        <Controller control={form.control} name="leave_type" render={({ field }) => (
          <SelectField id="leave-type" value={field.value} onChange={field.onChange} placeholder="Select type"
            options={LEAVE_TYPES.map((t) => ({ value: t, label: t }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="leave-start" label="First day" error={errors.start_date?.message}>
          <Input id="leave-start" type="date" aria-invalid={!!errors.start_date} {...form.register("start_date")} />
        </Field>
        <Field id="leave-end" label="Last day" error={errors.end_date?.message} hint={days ? plural(days, "day") : undefined}>
          <Input id="leave-end" type="date" aria-invalid={!!errors.end_date} {...form.register("end_date")} />
        </Field>
      </div>
      <Field id="leave-reason" label="Reason">
        <Textarea id="leave-reason" rows={3} {...form.register("reason")} />
      </Field>
    </FormDialog>
  )
}

/** Reject a request, with an optional note for the record. */
export function RejectLeaveDialog({ leave, onOpenChange }: { leave: LeaveRequest | null; onOpenChange: (o: boolean) => void }) {
  return leave ? <RejectLeaveBody key={leave.id} leave={leave} onOpenChange={onOpenChange} /> : null
}

function RejectLeaveBody({ leave, onOpenChange }: { leave: LeaveRequest; onOpenChange: (o: boolean) => void }) {
  const reject = useAction<{ note: string }>("workforce/leave", "reject", { success: "Leave request rejected.", invalidate: WORKFORCE_LISTS })
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  return (
    <FormDialog open onOpenChange={onOpenChange} title={`Reject leave for ${leave.employee_name}?`}
      description={`${leave.leave_type} leave, ${plural(leave.days, "day")}. The request stays on record as rejected.`}
      error={error} submitting={reject.isPending} submitLabel="Reject"
      onSubmit={async (e) => {
        e.preventDefault()
        setError("")
        try {
          await reject.mutateAsync({ id: leave.id, body: { note } })
          onOpenChange(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not reject the request.")
        }
      }}>
      <Field id="reject-note" label="Reason for rejecting" hint="Optional">
        <Textarea id="reject-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormDialog>
  )
}

// ─── Task ───────────────────────────────────────────────────────────────────

type TaskDialogProps = DialogProps<TaskAssignment> & { employees: Employee[] }

export function TaskDialog(props: TaskDialogProps) {
  return props.open ? <TaskDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function TaskDialogBody({ open, onOpenChange, record, employees }: TaskDialogProps) {
  const save = useSave<TaskAssignment>("workforce/tasks", { noun: "Task", invalidate: WORKFORCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      employee: record ? String(record.employee) : "",
      title: record?.title ?? "",
      description: record?.description ?? "",
      date: record?.date ?? today(),
      area: record?.area ?? "",
      reference: record?.reference ?? "",
      status: record?.status ?? "Assigned",
      hours_spent: record?.hours_spent ? String(Number(record.hours_spent)) : "",
      output_kg: record?.output_kg ? String(Number(record.output_kg)) : "",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: { ...values, employee: Number(values.employee), hours_spent: orNull(values.hours_spent), output_kg: orNull(values.output_kg) },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit task" : "Assign task"}
      description="Hours and output of finished tasks feed the productivity report."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="task-employee" label="Employee" error={errors.employee?.message}>
        <Controller control={form.control} name="employee" render={({ field }) => (
          <SelectField id="task-employee" value={field.value} onChange={field.onChange} invalid={!!errors.employee}
            placeholder="Select employee" options={employeeOptions(employees, record?.employee)} />
        )} />
      </Field>
      <Field id="task-title" label="Task" error={errors.title?.message}>
        <Input id="task-title" placeholder="e.g. Sort mixed cotton" aria-invalid={!!errors.title} {...form.register("title")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="task-date" label="Date" error={errors.date?.message}>
          <Input id="task-date" type="date" aria-invalid={!!errors.date} {...form.register("date")} />
        </Field>
        <Field id="task-status" label="Status">
          <Controller control={form.control} name="status" render={({ field }) => (
            <SelectField id="task-status" value={field.value} onChange={field.onChange} placeholder="Select status"
              options={TASK_STATUSES.map((s) => ({ value: s, label: s }))} />
          )} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="task-area" label="Area">
          <Controller control={form.control} name="area" render={({ field }) => (
            <SelectField id="task-area" value={field.value} onChange={field.onChange} placeholder="None" allowNone="None"
              options={TASK_AREAS.map((a) => ({ value: a, label: a }))} />
          )} />
        </Field>
        <Field id="task-reference" label="Reference" hint="e.g. Tank A-01, Sorting session #12" error={errors.reference?.message}>
          <Input id="task-reference" {...form.register("reference")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="task-hours" label="Hours spent" error={errors.hours_spent?.message}>
          <Input id="task-hours" inputMode="decimal" aria-invalid={!!errors.hours_spent} {...form.register("hours_spent")} />
        </Field>
        <Field id="task-output" label="Output (kg)" error={errors.output_kg?.message}>
          <Input id="task-output" inputMode="decimal" aria-invalid={!!errors.output_kg} {...form.register("output_kg")} />
        </Field>
      </div>
      <Field id="task-description" label="Details">
        <Textarea id="task-description" rows={2} {...form.register("description")} />
      </Field>
    </FormDialog>
  )
}
