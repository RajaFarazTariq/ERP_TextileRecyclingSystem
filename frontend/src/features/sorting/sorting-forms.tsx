"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"

import { Field, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAction, useSave } from "@/lib/crud"
import { kg } from "@/lib/format"
import { applyServerErrors } from "@/lib/forms"
import type { FabricLot, FactoryUnit, SortingSession, StockEntry, UserSummary } from "@/types/api"
import {
  type CompleteForm,
  FABRIC_STATUSES,
  type FabricForm,
  type SessionForm,
  completeSchema,
  fabricSchema,
  sessionSchema,
} from "./schemas"

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

// ─── Sorting session ────────────────────────────────────────────────────────

type SessionDialogProps = DialogProps<SortingSession> & {
  fabrics: FabricLot[]
  users: UserSummary[]
  units: FactoryUnit[]
}

export function SessionDialog(props: SessionDialogProps) {
  return props.open ? <SessionDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function SessionDialogBody({ open, onOpenChange, record, fabrics, users, units }: SessionDialogProps) {
  const save = useSave<SortingSession>("sorting/sessions", { noun: "Sorting session", invalidate: [["sorting/fabric-stock"]] })
  const [formError, setFormError] = useState("")
  const form = useForm<SessionForm>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      fabric: record ? String(record.fabric) : "",
      supervisor: record ? String(record.supervisor) : "",
      unit: record?.unit ?? "",
      quantity_taken: record?.quantity_taken ?? "",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState

  // Units come from the factory units list; keep an older free-text value selectable
  const unitNames = units.map((u) => u.name)
  if (record?.unit && !unitNames.includes(record.unit)) unitNames.push(record.unit)

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: { ...values, fabric: Number(values.fabric), supervisor: Number(values.supervisor) },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["fabric", "supervisor", "unit", "quantity_taken", "notes"]))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit sorting session" : "Start sorting session"}
      description="Fabric taken from a lot to be sorted." error={formError} submitting={isSubmitting}
      submitLabel={record ? "Update" : "Start session"} onSubmit={onSubmit}>
      <Field id="fabric" label="Fabric lot" error={errors.fabric?.message}>
        <Controller control={form.control} name="fabric" render={({ field }) => (
          <SelectField id="fabric" value={field.value} onChange={field.onChange} invalid={!!errors.fabric}
            placeholder="Select fabric lot"
            options={fabrics.map((f) => ({ value: String(f.id), label: `${f.material_type} — ${kg(f.remaining_quantity)} left` }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="supervisor" label="Supervisor" error={errors.supervisor?.message}>
          <Controller control={form.control} name="supervisor" render={({ field }) => (
            <SelectField id="supervisor" value={field.value} onChange={field.onChange} invalid={!!errors.supervisor}
              placeholder="Select supervisor"
              options={users.filter((u) => u.is_active).map((u) => ({ value: String(u.id), label: `${u.username} (${u.role_label})` }))} />
          )} />
        </Field>
        <Field id="unit" label="Unit" error={errors.unit?.message}>
          <Controller control={form.control} name="unit" render={({ field }) => (
            <SelectField id="unit" value={field.value} onChange={field.onChange} invalid={!!errors.unit}
              placeholder="Select unit" options={unitNames.map((n) => ({ value: n, label: n }))} />
          )} />
        </Field>
      </div>
      <Field id="quantity_taken" label="Quantity taken (kg)" error={errors.quantity_taken?.message}>
        <Input id="quantity_taken" inputMode="decimal" aria-invalid={!!errors.quantity_taken} {...form.register("quantity_taken")} />
      </Field>
      <Field id="notes" label="Notes" error={errors.notes?.message}>
        <Textarea id="notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Complete a session ─────────────────────────────────────────────────────

export function CompleteDialog({ session, onOpenChange }: { session: SortingSession | null; onOpenChange: (open: boolean) => void }) {
  return session ? <CompleteDialogBody key={session.id} session={session} onOpenChange={onOpenChange} /> : null
}

function CompleteDialogBody({ session, onOpenChange }: { session: SortingSession; onOpenChange: (open: boolean) => void }) {
  const complete = useAction<CompleteForm>("sorting/sessions", "complete", {
    success: "Sorting session completed.",
    invalidate: [["sorting/fabric-stock"]],
  })
  const [formError, setFormError] = useState("")
  const form = useForm<CompleteForm>({ resolver: zodResolver(completeSchema), defaultValues: { quantity_sorted: "", waste_quantity: "0" } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await complete.mutateAsync({ id: session.id, body: values })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["quantity_sorted", "waste_quantity"]))
    }
  })

  return (
    <FormDialog open onOpenChange={onOpenChange} title="Complete sorting session"
      description={`${session.fabric_material} · ${kg(session.quantity_taken)} taken. Sorted plus waste can't exceed that.`}
      error={formError} submitting={isSubmitting} submitLabel="Mark complete" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="quantity_sorted" label="Quantity sorted (kg)" error={errors.quantity_sorted?.message}>
          <Input id="quantity_sorted" inputMode="decimal" autoFocus aria-invalid={!!errors.quantity_sorted} {...form.register("quantity_sorted")} />
        </Field>
        <Field id="waste_quantity" label="Waste (kg)" error={errors.waste_quantity?.message}>
          <Input id="waste_quantity" inputMode="decimal" aria-invalid={!!errors.waste_quantity} {...form.register("waste_quantity")} />
        </Field>
      </div>
    </FormDialog>
  )
}

// ─── Fabric lot ─────────────────────────────────────────────────────────────

type FabricDialogProps = DialogProps<FabricLot> & { deliveries: StockEntry[] }

export function FabricDialog(props: FabricDialogProps) {
  return props.open ? <FabricDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function FabricDialogBody({ open, onOpenChange, record, deliveries }: FabricDialogProps) {
  const save = useSave<FabricLot>("sorting/fabric-stock", { noun: "Fabric lot" })
  const [formError, setFormError] = useState("")
  const form = useForm<FabricForm>({
    resolver: zodResolver(fabricSchema),
    defaultValues: {
      stock: record ? String(record.stock) : "",
      material_type: record?.material_type ?? "",
      initial_quantity: record?.initial_quantity ?? "",
      status: record?.status ?? "In Warehouse",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, stock: Number(values.stock) } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["stock", "material_type", "initial_quantity", "status"]))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit fabric lot" : "Add fabric lot"}
      description={record ? `Remaining ${kg(record.remaining_quantity)} changes through sorting sessions; changing the initial quantity adjusts it by the same amount.` : "Material from a warehouse delivery, ready to be sorted."}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="stock" label="Warehouse delivery" error={errors.stock?.message}>
        <Controller control={form.control} name="stock" render={({ field }) => (
          <SelectField id="stock" value={field.value} onChange={field.onChange} invalid={!!errors.stock}
            placeholder="Select delivery"
            options={deliveries.map((d) => ({ value: String(d.id), label: `${d.fabric_type} — ${d.vendor_name}, ${kg(d.our_weight)}` }))} />
        )} />
      </Field>
      <Field id="material_type" label="Material type" error={errors.material_type?.message}>
        <Input id="material_type" placeholder="e.g. Cotton White Grade A" aria-invalid={!!errors.material_type} {...form.register("material_type")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="initial_quantity" label="Initial quantity (kg)" error={errors.initial_quantity?.message}>
          <Input id="initial_quantity" inputMode="decimal" aria-invalid={!!errors.initial_quantity} {...form.register("initial_quantity")} />
        </Field>
        <Field id="fabric-status" label="Status" error={errors.status?.message}>
          <Controller control={form.control} name="status" render={({ field }) => (
            <SelectField id="fabric-status" value={field.value} onChange={field.onChange} placeholder="Status"
              options={FABRIC_STATUSES.map((s) => ({ value: s, label: s }))} />
          )} />
        </Field>
      </div>
    </FormDialog>
  )
}
