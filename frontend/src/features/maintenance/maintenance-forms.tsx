"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { Field, FieldGroup, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { today } from "@/features/procurement/schemas"
import { useAction, useDelete, useSave } from "@/lib/crud"
import { date, displayName, rupees } from "@/lib/format"
import { applyServerErrors } from "@/lib/forms"
import type { Dryer, Tank, UserSummary } from "@/types/api"
import type { Machine, MaintenanceSchedule, PartUse, SparePart, WorkOrder } from "@/types/maintenance"
import {
  CATEGORIES, type CompleteForm, KINDS, MACHINE_STATUSES, type MachineForm, ORDER_TONES, PRIORITIES, PRIORITY_TONES,
  type PartForm, type PartUseForm, type ReceiveForm, type ScheduleForm, type WorkOrderForm, completeSchema,
  machineSchema, minutesText, partSchema, partUseSchema, receiveSchema, scheduleSchema, workOrderSchema,
} from "./schemas"

// Every maintenance list and report: a step on a work order changes machines, schedules, parts and the figures
export const MAINTENANCE_LISTS = [
  ["maintenance/machines"], ["maintenance/work-orders"], ["maintenance/schedules"], ["maintenance/parts"],
  ["maintenance/summary"], ["maintenance/performance"],
]

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

const orNull = (v: string) => (v ? v : null)
const amount = (v: string | number) => Number(v).toLocaleString("en-PK", { maximumFractionDigits: 2 })
const YES_NO = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]

// ─── Machine ────────────────────────────────────────────────────────────────

type MachineDialogProps = DialogProps<Machine> & { tanks: Tank[]; dryers: Dryer[] }

export function MachineDialog(props: MachineDialogProps) {
  return props.open ? <MachineDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function MachineDialogBody({ open, onOpenChange, record, tanks, dryers }: MachineDialogProps) {
  const save = useSave<Machine>("maintenance/machines", { noun: "Machine", invalidate: MAINTENANCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<MachineForm>({
    resolver: zodResolver(machineSchema),
    defaultValues: {
      code: record?.code ?? "",
      name: record?.name ?? "",
      category: record?.category ?? "",
      location: record?.location ?? "",
      manufacturer: record?.manufacturer ?? "",
      model: record?.model ?? "",
      serial_number: record?.serial_number ?? "",
      specifications: record?.specifications ?? "",
      installed_on: record?.installed_on ?? "",
      status: record?.status ?? "Running",
      hourly_operating_cost: record && Number(record.hourly_operating_cost) ? record.hourly_operating_cost : "",
      notes: record?.notes ?? "",
      equipment: record?.tank ? `tank-${record.tank}` : record?.dryer ? `dryer-${record.dryer}` : "",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ equipment, ...values }) => {
    setFormError("")
    const [kind, id] = equipment.split("-")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          installed_on: orNull(values.installed_on),
          hourly_operating_cost: values.hourly_operating_cost || "0",
          tank: kind === "tank" ? Number(id) : null,
          dryer: kind === "dryer" ? Number(id) : null,
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.code}` : "Add machine"}
      description="A machine in the register. Work orders change its status while it is being repaired."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="machine-code" label="Code" error={errors.code?.message}>
          <Input id="machine-code" placeholder="e.g. SH-01" aria-invalid={!!errors.code} {...form.register("code")} />
        </Field>
        <Field id="machine-name" label="Name" error={errors.name?.message}>
          <Input id="machine-name" placeholder="e.g. Fabric shredder" aria-invalid={!!errors.name} {...form.register("name")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="machine-category" label="Category" error={errors.category?.message}>
          <Input id="machine-category" list="machine-categories" placeholder="e.g. Shredder" {...form.register("category")} />
          <datalist id="machine-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field id="machine-location" label="Location" error={errors.location?.message}>
          <Input id="machine-location" placeholder="e.g. Sorting hall" {...form.register("location")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="machine-status" label="Status">
          <Controller control={form.control} name="status" render={({ field }) => (
            <SelectField id="machine-status" value={field.value} onChange={field.onChange} placeholder="Select status"
              options={MACHINE_STATUSES.map((s) => ({ value: s, label: s }))} />
          )} />
        </Field>
        <Field id="machine-cost" label="Running cost per hour (Rs.)" error={errors.hourly_operating_cost?.message}>
          <Input id="machine-cost" inputMode="decimal" aria-invalid={!!errors.hourly_operating_cost} {...form.register("hourly_operating_cost")} />
        </Field>
      </div>
      <Field id="machine-equipment" label="Linked tank or dryer" hint="Shows the machine's downtime next to the batches run on it">
        <Controller control={form.control} name="equipment" render={({ field }) => (
          <SelectField id="machine-equipment" value={field.value} onChange={field.onChange} placeholder="None" allowNone="None"
            options={[
              ...tanks.map((t) => ({ value: `tank-${t.id}`, label: `Tank: ${t.name}` })),
              ...dryers.map((d) => ({ value: `dryer-${d.id}`, label: `Dryer: ${d.name}` })),
            ]} />
        )} />
      </Field>
      <FieldGroup title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="machine-manufacturer" label="Manufacturer" error={errors.manufacturer?.message}>
            <Input id="machine-manufacturer" {...form.register("manufacturer")} />
          </Field>
          <Field id="machine-model" label="Model" error={errors.model?.message}>
            <Input id="machine-model" {...form.register("model")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="machine-serial" label="Serial number" error={errors.serial_number?.message}>
            <Input id="machine-serial" {...form.register("serial_number")} />
          </Field>
          <Field id="machine-installed" label="Installed on" error={errors.installed_on?.message}>
            <Input id="machine-installed" type="date" {...form.register("installed_on")} />
          </Field>
        </div>
        <Field id="machine-specs" label="Specifications" hint="Capacity, power, sizes">
          <Textarea id="machine-specs" rows={2} {...form.register("specifications")} />
        </Field>
        <Field id="machine-notes" label="Notes">
          <Textarea id="machine-notes" rows={2} {...form.register("notes")} />
        </Field>
      </FieldGroup>
    </FormDialog>
  )
}

const machineOptions = (machines: Machine[], keep?: number | null) =>
  machines.filter((m) => m.status !== "Retired" || m.id === keep).map((m) => ({ value: String(m.id), label: `${m.code} · ${m.name}` }))

// ─── Preventive schedule ────────────────────────────────────────────────────

type ScheduleDialogProps = DialogProps<MaintenanceSchedule> & { machines: Machine[] }

export function ScheduleDialog(props: ScheduleDialogProps) {
  return props.open ? <ScheduleDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function ScheduleDialogBody({ open, onOpenChange, record, machines }: ScheduleDialogProps) {
  const save = useSave<MaintenanceSchedule>("maintenance/schedules", { noun: "Schedule", invalidate: MAINTENANCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      machine: record ? String(record.machine) : "",
      task: record?.task ?? "",
      every_days: record ? String(record.every_days) : "30",
      start_date: record?.start_date ?? today(),
      last_done_on: record?.last_done_on ?? "",
      instructions: record?.instructions ?? "",
      is_active: record?.is_active === false ? "no" : "yes",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          machine: Number(values.machine),
          every_days: Number(values.every_days),
          last_done_on: orNull(values.last_done_on),
          is_active: values.is_active === "yes",
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit schedule" : "New schedule"}
      description="Preventive work repeated every few days. The next due date is counted from the last time it was done."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="schedule-machine" label="Machine" error={errors.machine?.message}>
        <Controller control={form.control} name="machine" render={({ field }) => (
          <SelectField id="schedule-machine" value={field.value} onChange={field.onChange} invalid={!!errors.machine}
            placeholder="Select machine" options={machineOptions(machines, record?.machine)} />
        )} />
      </Field>
      <Field id="schedule-task" label="Task" error={errors.task?.message}>
        <Input id="schedule-task" placeholder="e.g. Grease conveyor bearings" aria-invalid={!!errors.task} {...form.register("task")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="schedule-every" label="Every (days)" error={errors.every_days?.message}>
          <Input id="schedule-every" inputMode="numeric" aria-invalid={!!errors.every_days} {...form.register("every_days")} />
        </Field>
        <Field id="schedule-active" label="Status">
          <Controller control={form.control} name="is_active" render={({ field }) => (
            <SelectField id="schedule-active" value={field.value} onChange={field.onChange} placeholder="Select status"
              options={[{ value: "yes", label: "In use" }, { value: "no", label: "Not in use" }]} />
          )} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="schedule-start" label="First due on" hint="Used until the task is done once" error={errors.start_date?.message}>
          <Input id="schedule-start" type="date" aria-invalid={!!errors.start_date} {...form.register("start_date")} />
        </Field>
        <Field id="schedule-last" label="Last done on" hint="Optional" error={errors.last_done_on?.message}>
          <Input id="schedule-last" type="date" {...form.register("last_done_on")} />
        </Field>
      </div>
      <Field id="schedule-instructions" label="Instructions" hint="Copied into each work order">
        <Textarea id="schedule-instructions" rows={3} {...form.register("instructions")} />
      </Field>
    </FormDialog>
  )
}

// ─── Work order ─────────────────────────────────────────────────────────────

type WorkOrderDialogProps = DialogProps<WorkOrder> & {
  machines: Machine[]
  users: UserSummary[]
  /** Admins plan any work and assign people; other roles report a problem */
  admin: boolean
}

export function WorkOrderDialog(props: WorkOrderDialogProps) {
  return props.open ? <WorkOrderDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function WorkOrderDialogBody({ open, onOpenChange, record, machines, users, admin }: WorkOrderDialogProps) {
  const save = useSave<WorkOrder>("maintenance/work-orders", { noun: "Work order", invalidate: MAINTENANCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<WorkOrderForm>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      machine: record ? String(record.machine) : "",
      kind: record?.kind ?? "Corrective",
      title: record?.title ?? "",
      description: record?.description ?? "",
      priority: record?.priority ?? (admin ? "Normal" : "High"),
      is_breakdown: record ? (record.is_breakdown ? "yes" : "no") : admin ? "no" : "yes",
      assigned_to: record?.assigned_to ? String(record.assigned_to) : "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const kind = useWatch({ control: form.control, name: "kind" })

  const onSubmit = form.handleSubmit(async ({ assigned_to, kind: chosenKind, ...values }) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          machine: Number(values.machine),
          is_breakdown: chosenKind === "Corrective" && values.is_breakdown === "yes",
          // Only an admin sends the type and the assignee; the server refuses them from other roles
          ...(admin ? { kind: chosenKind, assigned_to: assigned_to ? Number(assigned_to) : null } : {}),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, [...Object.keys(values), "assigned_to", "kind"]))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange}
      title={record ? `Edit ${record.number}` : admin ? "New work order" : "Report breakdown"}
      description={admin
        ? "A job on a machine. A breakdown marks the machine as broken down until the work is done."
        : "Tell maintenance what is wrong. The machine is marked as broken down until the work is done."}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : admin ? "Save" : "Report"} onSubmit={onSubmit}>
      <Field id="order-machine" label="Machine" error={errors.machine?.message}>
        <Controller control={form.control} name="machine" render={({ field }) => (
          <SelectField id="order-machine" value={field.value} onChange={field.onChange} invalid={!!errors.machine}
            disabled={!!record && !admin} placeholder="Select machine" options={machineOptions(machines, record?.machine)} />
        )} />
      </Field>
      <Field id="order-title" label={admin ? "Job" : "What is wrong"} error={errors.title?.message}>
        <Input id="order-title" placeholder="e.g. Conveyor belt slipping" aria-invalid={!!errors.title} {...form.register("title")} />
      </Field>
      <Field id="order-description" label="Details" error={errors.description?.message}>
        <Textarea id="order-description" rows={3} placeholder="What you saw or heard, and since when" {...form.register("description")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {admin && (
          <Field id="order-kind" label="Type" error={errors.kind?.message}>
            <Controller control={form.control} name="kind" render={({ field }) => (
              <SelectField id="order-kind" value={field.value} onChange={field.onChange} placeholder="Select type"
                options={KINDS.map((k) => ({ value: k, label: k === "Corrective" ? "Corrective (repair)" : "Preventive (planned)" }))} />
            )} />
          </Field>
        )}
        <Field id="order-priority" label="Priority">
          <Controller control={form.control} name="priority" render={({ field }) => (
            <SelectField id="order-priority" value={field.value} onChange={field.onChange} placeholder="Select priority"
              options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
          )} />
        </Field>
        {kind === "Corrective" && (
          <Field id="order-breakdown" label="Machine stopped">
            <Controller control={form.control} name="is_breakdown" render={({ field }) => (
              <SelectField id="order-breakdown" value={field.value} onChange={field.onChange} placeholder="Select" options={YES_NO} />
            )} />
          </Field>
        )}
        {admin && (
          <Field id="order-assigned" label="Assigned to" hint="Leave empty to let anyone pick it up" error={errors.assigned_to?.message}>
            <Controller control={form.control} name="assigned_to" render={({ field }) => (
              <SelectField id="order-assigned" value={field.value} onChange={field.onChange} placeholder="Nobody yet" allowNone="Nobody yet"
                options={users.filter((u) => u.is_active || u.id === record?.assigned_to).map((u) => ({ value: String(u.id), label: displayName(u.username) }))} />
            )} />
          </Field>
        )}
      </div>
    </FormDialog>
  )
}

// ─── Complete a work order ──────────────────────────────────────────────────

export function CompleteDialog({ order, onOpenChange }: { order: WorkOrder | null; onOpenChange: (o: boolean) => void }) {
  return order ? <CompleteDialogBody key={order.id} order={order} onOpenChange={onOpenChange} /> : null
}

function CompleteDialogBody({ order, onOpenChange }: { order: WorkOrder; onOpenChange: (o: boolean) => void }) {
  const complete = useAction<Record<string, unknown>>("maintenance/work-orders", "complete", { success: "Work order completed.", invalidate: MAINTENANCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<CompleteForm>({
    resolver: zodResolver(completeSchema),
    defaultValues: { work_done: "", downtime_minutes: "", labour_hours: "", labour_cost: "", other_cost: "" },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await complete.mutateAsync({
        id: order.id,
        body: { ...values, downtime_minutes: values.downtime_minutes ? Number(values.downtime_minutes) : 0 },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open onOpenChange={onOpenChange} title={`Complete ${order.number}`}
      description={`${order.title} on ${order.machine_code} ${order.machine_name}. The machine goes back to Running.`}
      error={formError} submitting={isSubmitting} submitLabel="Complete" onSubmit={onSubmit}>
      <Field id="work_done" label="Work done" error={errors.work_done?.message}>
        <Textarea id="work_done" rows={3} placeholder="What was repaired, replaced or checked" aria-invalid={!!errors.work_done} {...form.register("work_done")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="downtime_minutes" label="Downtime, minutes" hint="How long the machine was stopped" error={errors.downtime_minutes?.message}>
          <Input id="downtime_minutes" inputMode="numeric" aria-invalid={!!errors.downtime_minutes} {...form.register("downtime_minutes")} />
        </Field>
        <Field id="labour_hours" label="Labour hours" error={errors.labour_hours?.message}>
          <Input id="labour_hours" inputMode="decimal" aria-invalid={!!errors.labour_hours} {...form.register("labour_hours")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="labour_cost" label="Labour cost (Rs.)" error={errors.labour_cost?.message}>
          <Input id="labour_cost" inputMode="decimal" aria-invalid={!!errors.labour_cost} {...form.register("labour_cost")} />
        </Field>
        <Field id="other_cost" label="Other cost (Rs.)" hint="Outside services, transport" error={errors.other_cost?.message}>
          <Input id="other_cost" inputMode="decimal" aria-invalid={!!errors.other_cost} {...form.register("other_cost")} />
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">
        Parts used so far: <span className="font-medium text-foreground">{rupees(order.parts_cost)}</span>. Add parts before completing; they can&apos;t be changed afterwards.
      </p>
    </FormDialog>
  )
}

// ─── Spare part ─────────────────────────────────────────────────────────────

export function PartDialog(props: DialogProps<SparePart>) {
  return props.open ? <PartDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function PartDialogBody({ open, onOpenChange, record }: DialogProps<SparePart>) {
  const save = useSave<SparePart>("maintenance/parts", { noun: "Spare part", invalidate: MAINTENANCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<PartForm>({
    resolver: zodResolver(partSchema),
    defaultValues: {
      code: record?.code ?? "",
      name: record?.name ?? "",
      unit: record?.unit ?? "pcs",
      stock_quantity: record?.stock_quantity ?? "",
      reorder_level: record?.reorder_level ?? "",
      unit_cost: record?.unit_cost ?? "",
      location: record?.location ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ stock_quantity, ...values }) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          reorder_level: values.reorder_level || "0",
          unit_cost: values.unit_cost || "0",
          // Stock is set once; afterwards it changes by receiving and by use on work orders
          ...(record ? {} : { stock_quantity: stock_quantity || "0" }),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, [...Object.keys(values), "stock_quantity"]))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.code}` : "Add spare part"}
      description={record ? "Stock changes with “Receive” and when parts are used on work orders." : "A part kept in the store for repairs."}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="part-code" label="Code" error={errors.code?.message}>
          <Input id="part-code" placeholder="e.g. BRG-6205" aria-invalid={!!errors.code} {...form.register("code")} />
        </Field>
        <Field id="part-unit" label="Unit" error={errors.unit?.message}>
          <Input id="part-unit" placeholder="pcs, L, set" aria-invalid={!!errors.unit} {...form.register("unit")} />
        </Field>
      </div>
      <Field id="part-name" label="Name" error={errors.name?.message}>
        <Input id="part-name" placeholder="e.g. Bearing 6205-2RS" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="part-stock" label="In stock" error={errors.stock_quantity?.message}>
          <Input id="part-stock" inputMode="decimal" disabled={!!record} aria-invalid={!!errors.stock_quantity} {...form.register("stock_quantity")} />
        </Field>
        <Field id="part-reorder" label="Reorder level" hint="Flagged when stock is at or below this" error={errors.reorder_level?.message}>
          <Input id="part-reorder" inputMode="decimal" aria-invalid={!!errors.reorder_level} {...form.register("reorder_level")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="part-cost" label="Cost per unit (Rs.)" error={errors.unit_cost?.message}>
          <Input id="part-cost" inputMode="decimal" aria-invalid={!!errors.unit_cost} {...form.register("unit_cost")} />
        </Field>
        <Field id="part-location" label="Store location" error={errors.location?.message}>
          <Input id="part-location" placeholder="e.g. Rack A2" {...form.register("location")} />
        </Field>
      </div>
    </FormDialog>
  )
}

export function ReceiveDialog({ part, onOpenChange }: { part: SparePart | null; onOpenChange: (o: boolean) => void }) {
  return part ? <ReceiveDialogBody key={part.id} part={part} onOpenChange={onOpenChange} /> : null
}

function ReceiveDialogBody({ part, onOpenChange }: { part: SparePart; onOpenChange: (o: boolean) => void }) {
  const receive = useAction<Record<string, unknown>>("maintenance/parts", "receive", { success: "Stock received.", invalidate: MAINTENANCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<ReceiveForm>({ resolver: zodResolver(receiveSchema), defaultValues: { quantity: "", unit_cost: "" } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await receive.mutateAsync({ id: part.id, body: { quantity: values.quantity, ...(values.unit_cost ? { unit_cost: values.unit_cost } : {}) } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open onOpenChange={onOpenChange} title={`Receive ${part.name}`}
      description={`${amount(part.stock_quantity)} ${part.unit} in stock now. The quantity is added to it.`}
      error={formError} submitting={isSubmitting} submitLabel="Receive" onSubmit={onSubmit}>
      <Field id="receive-quantity" label={`Quantity received, ${part.unit}`} error={errors.quantity?.message}>
        <Input id="receive-quantity" inputMode="decimal" aria-invalid={!!errors.quantity} {...form.register("quantity")} />
      </Field>
      <Field id="receive-cost" label="New cost per unit (Rs.)" hint={`Leave empty to keep ${rupees(part.unit_cost)}`} error={errors.unit_cost?.message}>
        <Input id="receive-cost" inputMode="decimal" aria-invalid={!!errors.unit_cost} {...form.register("unit_cost")} />
      </Field>
    </FormDialog>
  )
}

// ─── One work order: details and parts used ─────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  )
}

type OrderSheetProps = {
  order: WorkOrder | null
  onOpenChange: (open: boolean) => void
  parts: SparePart[]
  /** May add parts: an admin, the assigned person, or anyone when nobody is assigned */
  canWork: boolean
  admin: boolean
}

export function WorkOrderSheet({ order, onOpenChange, ...rest }: OrderSheetProps) {
  return (
    <Sheet open={!!order} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 bg-elevated p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {order && <WorkOrderSheetBody key={order.id} order={order} {...rest} />}
      </SheetContent>
    </Sheet>
  )
}

function WorkOrderSheetBody({ order, parts, canWork, admin }: Omit<OrderSheetProps, "onOpenChange" | "order"> & { order: WorkOrder }) {
  const add = useSave<PartUse>("maintenance/part-uses", { noun: "Part", invalidate: MAINTENANCE_LISTS })
  const remove = useDelete("maintenance/part-uses", { noun: "Part", invalidate: MAINTENANCE_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<PartUseForm>({ resolver: zodResolver(partUseSchema), defaultValues: { part: "", quantity: "" } })
  const { errors, isSubmitting } = form.formState
  const closed = order.status === "Done" || order.status === "Cancelled"

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await add.mutateAsync({ body: { work_order: order.id, part: Number(values.part), quantity: values.quantity } })
      form.reset()
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <>
      <SheetHeader className="border-b px-6 pt-5 pb-4">
        <SheetTitle className="font-heading text-lg font-semibold tracking-tight">Work order {order.number}</SheetTitle>
        <SheetDescription>{order.machine_code} · {order.machine_name}</SheetDescription>
      </SheetHeader>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={order.status} tone={ORDER_TONES[order.status]} />
          <StatusBadge status={`${order.priority} priority`} tone={PRIORITY_TONES[order.priority]} />
          {order.is_breakdown && <StatusBadge status="Breakdown" tone="danger" />}
        </div>
        <div>
          <p className="font-medium">{order.title}</p>
          {order.description && <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{order.description}</p>}
        </div>
        <dl className="space-y-2">
          <Row label="Type">{order.kind}{order.schedule_task ? " · from a schedule" : ""}</Row>
          <Row label="Reported">{date(order.reported_at)} by {displayName(order.reported_by_name)}</Row>
          <Row label="Assigned to">{order.assigned_to_name ? displayName(order.assigned_to_name) : "Nobody yet"}</Row>
          {order.started_at && <Row label="Started">{date(order.started_at)}</Row>}
          {order.completed_at && <Row label="Completed">{date(order.completed_at)}</Row>}
          {order.status === "Done" && (
            <>
              <Row label="Downtime">{minutesText(order.downtime_minutes)}</Row>
              <Row label="Labour">{amount(order.labour_hours)} h · {rupees(order.labour_cost)}</Row>
              <Row label="Other cost">{rupees(order.other_cost)}</Row>
            </>
          )}
          <Row label="Parts">{rupees(order.parts_cost)}</Row>
          <Row label="Total cost">{rupees(order.total_cost)}</Row>
        </dl>
        {order.work_done && (
          <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-sm">
            <span className="font-semibold">Work done:</span> {order.work_done}
          </p>
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Parts used</h3>
          {order.parts.length ? (
            <ul className="divide-y rounded-xl border">
              {order.parts.map((use) => (
                <li key={use.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{use.part_name}</span>
                    <span className="block text-xs text-muted-foreground">{amount(use.quantity)} {use.unit} × {rupees(use.unit_cost)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{rupees(use.cost)}</span>
                  {admin && !closed && (
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${use.part_name}`}
                      disabled={remove.isPending} onClick={() => remove.mutate(use.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="rounded-xl border px-3 py-5 text-center text-sm text-muted-foreground">No parts have been used on this job.</p>}
        </section>

        {!closed && canWork && (
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Use a part</h3>
            {formError && <p role="alert" className="text-sm text-danger-fg">{formError}</p>}
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
              <Field id="use-part" label="Part" error={errors.part?.message}>
                <Controller control={form.control} name="part" render={({ field }) => (
                  <SelectField id="use-part" value={field.value} onChange={field.onChange} invalid={!!errors.part} placeholder="Select part"
                    options={parts.map((p) => ({ value: String(p.id), label: `${p.name} (${amount(p.stock_quantity)} ${p.unit} in stock)` }))} />
                )} />
              </Field>
              <Field id="use-quantity" label="Quantity" error={errors.quantity?.message}>
                <Input id="use-quantity" inputMode="decimal" aria-invalid={!!errors.quantity} {...form.register("quantity")} />
              </Field>
              <Button type="submit" variant="outline" className="sm:mt-[1.6rem]" disabled={isSubmitting}>
                <Plus className="size-4" /> Add part
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">The quantity is taken from the spare parts stock at today&apos;s cost.</p>
          </form>
        )}
      </div>
    </>
  )
}
