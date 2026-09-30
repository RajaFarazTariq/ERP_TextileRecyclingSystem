"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"

import { Field, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ROLE_LABELS } from "@/config/access"
import { useAction, useSave } from "@/lib/crud"
import { kg } from "@/lib/format"
import { applyServerErrors } from "@/lib/forms"
import type { DecolorDoneOption, Dryer, DryingSession, FabricReadyOption, UserSummary } from "@/types/api"
import {
  type CompleteForm,
  DRYER_STATUSES,
  DRYER_TYPES,
  type DryerForm,
  SESSION_STATUSES,
  type SessionForm,
  completeSchema,
  dryerSchema,
  sessionSchema,
} from "./schemas"

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

// ─── Dryer ──────────────────────────────────────────────────────────────────

export function DryerDialog(props: DialogProps<Dryer>) {
  return props.open ? <DryerDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function DryerDialogBody({ open, onOpenChange, record }: DialogProps<Dryer>) {
  const save = useSave<Dryer>("drying/dryers", { noun: "Dryer" })
  const [formError, setFormError] = useState("")
  const form = useForm<DryerForm>({
    resolver: zodResolver(dryerSchema),
    defaultValues: {
      name: record?.name ?? "",
      dryer_type: record?.dryer_type ?? "Tumble",
      capacity: record?.capacity ?? "",
      status: record?.status ?? "Available",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: values })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit dryer" : "Add dryer"}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="dryer-name" label="Dryer name" error={errors.name?.message}>
        <Input id="dryer-name" placeholder="e.g. Dryer D-01" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="dryer_type" label="Type">
          <Controller control={form.control} name="dryer_type" render={({ field }) => (
            <SelectField id="dryer_type" value={field.value} onChange={field.onChange} placeholder="Type"
              options={DRYER_TYPES.map((t) => ({ value: t, label: `${t} dryer` }))} />
          )} />
        </Field>
        <Field id="dryer-capacity" label="Capacity (kg)" error={errors.capacity?.message}>
          <Input id="dryer-capacity" inputMode="decimal" aria-invalid={!!errors.capacity} {...form.register("capacity")} />
        </Field>
        <Field id="dryer-status" label="Status">
          <Controller control={form.control} name="status" render={({ field }) => (
            <SelectField id="dryer-status" value={field.value} onChange={field.onChange} placeholder="Status"
              options={DRYER_STATUSES.map((s) => ({ value: s, label: s }))} />
          )} />
        </Field>
      </div>
      <Field id="dryer-notes" label="Notes">
        <Textarea id="dryer-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Drying session ─────────────────────────────────────────────────────────

type SessionDialogProps = DialogProps<DryingSession> & {
  dryers: Dryer[]
  fabrics: FabricReadyOption[]
  decolorSessions: DecolorDoneOption[]
  users: UserSummary[]
}

export function SessionDialog(props: SessionDialogProps) {
  return props.open ? <SessionDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function SessionDialogBody({ open, onOpenChange, record, dryers, fabrics, decolorSessions, users }: SessionDialogProps) {
  const save = useSave<DryingSession>("drying/sessions", { noun: "Drying session", invalidate: [["drying/dryers"]] })
  const [formError, setFormError] = useState("")
  const form = useForm<SessionForm>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      dryer: record ? String(record.dryer) : "",
      fabric: record ? String(record.fabric) : "",
      decolor_session: record?.decolor_session ? String(record.decolor_session) : "",
      supervisor: record ? String(record.supervisor) : "",
      input_quantity: record?.input_quantity ?? "",
      temperature_celsius: record?.temperature_celsius ?? "",
      duration_minutes: record?.duration_minutes != null ? String(record.duration_minutes) : "",
      status: record?.status ?? "Pending",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState

  // The "ready" lists only hold unassigned items; keep this session's own choices selectable
  const fabricOptions = fabrics.map((f) => ({ value: String(f.id), label: `${f.material_type} (${kg(f.remaining_quantity)})` }))
  if (record && !fabricOptions.some((o) => o.value === String(record.fabric))) {
    fabricOptions.unshift({ value: String(record.fabric), label: record.fabric_material })
  }
  const decolorOptions = decolorSessions.map((d) => ({
    value: String(d.id),
    label: `#${d.id} ${d.tank__name} — ${d.fabric__material_type}, ${kg(d.output_quantity)} out`,
  }))
  if (record?.decolor_session && !decolorOptions.some((o) => o.value === String(record.decolor_session))) {
    decolorOptions.unshift({ value: String(record.decolor_session), label: `#${record.decolor_session} (linked)` })
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          dryer: Number(values.dryer),
          fabric: Number(values.fabric),
          supervisor: Number(values.supervisor),
          decolor_session: values.decolor_session ? Number(values.decolor_session) : null,
          temperature_celsius: values.temperature_celsius || null,
          duration_minutes: values.duration_minutes ? Number(values.duration_minutes) : null,
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit drying session" : "Add drying session"}
      description="Wet fabric from decolorization going into a dryer." error={formError} submitting={isSubmitting}
      submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="session-dryer" label="Dryer" error={errors.dryer?.message}>
          <Controller control={form.control} name="dryer" render={({ field }) => (
            <SelectField id="session-dryer" value={field.value} onChange={field.onChange} invalid={!!errors.dryer}
              placeholder="Select dryer"
              options={dryers.map((d) => ({ value: String(d.id), label: `${d.name} (${d.status})` }))} />
          )} />
        </Field>
        <Field id="session-fabric" label="Fabric (from decolorization)" error={errors.fabric?.message}>
          <Controller control={form.control} name="fabric" render={({ field }) => (
            <SelectField id="session-fabric" value={field.value} onChange={field.onChange} invalid={!!errors.fabric}
              placeholder={fabricOptions.length ? "Select fabric" : "No fabric ready for drying"} options={fabricOptions} />
          )} />
        </Field>
      </div>
      <Field id="decolor_session" label="Decolorization session" hint="Optional: the batch this fabric came from">
        <Controller control={form.control} name="decolor_session" render={({ field }) => (
          <SelectField id="decolor_session" value={field.value} onChange={field.onChange} placeholder="None"
            allowNone="None" options={decolorOptions} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="session-supervisor" label="Supervisor" error={errors.supervisor?.message}>
          <Controller control={form.control} name="supervisor" render={({ field }) => (
            <SelectField id="session-supervisor" value={field.value} onChange={field.onChange} invalid={!!errors.supervisor}
              placeholder="Select supervisor"
              options={users.filter((u) => u.is_active).map((u) => ({ value: String(u.id), label: `${u.username} (${ROLE_LABELS[u.role]})` }))} />
          )} />
        </Field>
        <Field id="input_quantity" label="Input quantity (kg)" error={errors.input_quantity?.message}>
          <Input id="input_quantity" inputMode="decimal" aria-invalid={!!errors.input_quantity} {...form.register("input_quantity")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="temperature_celsius" label="Temperature (°C)" error={errors.temperature_celsius?.message}>
          <Input id="temperature_celsius" inputMode="decimal" placeholder="e.g. 80" {...form.register("temperature_celsius")} />
        </Field>
        <Field id="duration_minutes" label="Duration (min)" error={errors.duration_minutes?.message}>
          <Input id="duration_minutes" inputMode="numeric" placeholder="e.g. 90" {...form.register("duration_minutes")} />
        </Field>
        <Field id="session-status" label="Status">
          <Controller control={form.control} name="status" render={({ field }) => (
            <SelectField id="session-status" value={field.value} onChange={field.onChange} placeholder="Status"
              options={SESSION_STATUSES.map((s) => ({ value: s, label: s }))} />
          )} />
        </Field>
      </div>
      <Field id="session-notes" label="Notes">
        <Textarea id="session-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Complete a session ─────────────────────────────────────────────────────

export function CompleteDialog({ session, onOpenChange }: { session: DryingSession | null; onOpenChange: (open: boolean) => void }) {
  return session ? <CompleteDialogBody key={session.id} session={session} onOpenChange={onOpenChange} /> : null
}

function CompleteDialogBody({ session, onOpenChange }: { session: DryingSession; onOpenChange: (open: boolean) => void }) {
  const complete = useAction<CompleteForm>("drying/sessions", "complete", {
    success: "Drying session completed. Output added to sellable stock.",
    invalidate: [["drying/dryers"], ["drying/fabric-ready"], ["sorting/fabric-stock"]],
  })
  const [formError, setFormError] = useState("")
  const form = useForm<CompleteForm>({
    resolver: zodResolver(completeSchema),
    defaultValues: { output_quantity: "", waste_quantity: "0", notes: session.notes ?? "" },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await complete.mutateAsync({ id: session.id, body: values })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["output_quantity", "waste_quantity", "notes"]))
    }
  })

  return (
    <FormDialog open onOpenChange={onOpenChange} title="Complete drying session"
      description={`${session.dryer_name} · ${session.fabric_material} · ${kg(session.input_quantity)} in. The dried output becomes sellable stock for this fabric lot.`}
      error={formError} submitting={isSubmitting} submitLabel="Mark complete" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="output_quantity" label="Dried output (kg)" error={errors.output_quantity?.message}>
          <Input id="output_quantity" inputMode="decimal" autoFocus aria-invalid={!!errors.output_quantity} {...form.register("output_quantity")} />
        </Field>
        <Field id="waste_quantity" label="Waste (kg)" error={errors.waste_quantity?.message}>
          <Input id="waste_quantity" inputMode="decimal" aria-invalid={!!errors.waste_quantity} {...form.register("waste_quantity")} />
        </Field>
      </div>
      <Field id="complete-notes" label="Notes">
        <Textarea id="complete-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}
