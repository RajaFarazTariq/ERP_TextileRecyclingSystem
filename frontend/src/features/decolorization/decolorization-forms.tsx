"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"

import { Field, FieldGroup, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ROLE_LABELS } from "@/config/access"
import { useAction, useSave } from "@/lib/crud"
import { kg } from "@/lib/format"
import { applyServerErrors } from "@/lib/forms"
import type {
  Chemical, ChemicalIssuance, DecolorizationSession, FabricOption, Recipe, SupplierOption, Tank, UserSummary,
} from "@/types/api"
import {
  type ChemicalForm,
  type CompleteForm,
  HAZARD_CLASSES,
  type IssuanceForm,
  type SessionForm,
  TANK_STATUSES,
  type TankForm,
  UNITS_OF_MEASURE,
  chemicalSchema,
  completeSchema,
  issuanceSchema,
  sessionSchema,
  tankSchema,
} from "./schemas"

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

const orNull = (v: string) => (v ? v : null)

/** Active suppliers, plus the one already on the record. */
export const supplierOptions = (suppliers: SupplierOption[], current?: number | null) =>
  suppliers.filter((s) => s.is_active || s.id === current).map((s) => ({ value: String(s.id), label: s.name }))

const userOptions = (users: UserSummary[]) =>
  users.filter((u) => u.is_active).map((u) => ({ value: String(u.id), label: `${u.username} (${ROLE_LABELS[u.role]})` }))

// ─── Tank ───────────────────────────────────────────────────────────────────

type TankDialogProps = DialogProps<Tank> & { fabrics: FabricOption[] }

export function TankDialog(props: TankDialogProps) {
  return props.open ? <TankDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function TankDialogBody({ open, onOpenChange, record, fabrics }: TankDialogProps) {
  const save = useSave<Tank>("decolorization/tanks", { noun: "Tank" })
  const [formError, setFormError] = useState("")
  const form = useForm<TankForm>({
    resolver: zodResolver(tankSchema),
    defaultValues: {
      name: record?.name ?? "",
      batch_id: record?.batch_id ?? "",
      capacity: record?.capacity ?? "",
      fabric_quantity: record?.fabric_quantity ?? "0",
      fabric: record?.fabric ? String(record.fabric) : "",
      tank_status: record?.tank_status ?? "Empty",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, fabric: values.fabric ? Number(values.fabric) : null } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit tank" : "Add tank"}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tank-name" label="Tank name" error={errors.name?.message}>
          <Input id="tank-name" placeholder="e.g. Tank A-01" aria-invalid={!!errors.name} {...form.register("name")} />
        </Field>
        <Field id="batch_id" label="Batch ID" error={errors.batch_id?.message}>
          <Input id="batch_id" aria-invalid={!!errors.batch_id} {...form.register("batch_id")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="capacity" label="Capacity (kg)" error={errors.capacity?.message}>
          <Input id="capacity" inputMode="decimal" aria-invalid={!!errors.capacity} {...form.register("capacity")} />
        </Field>
        <Field id="fabric_quantity" label="Current load (kg)" error={errors.fabric_quantity?.message}>
          <Input id="fabric_quantity" inputMode="decimal" aria-invalid={!!errors.fabric_quantity} {...form.register("fabric_quantity")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tank-fabric" label="Fabric" error={errors.fabric?.message}>
          <Controller control={form.control} name="fabric" render={({ field }) => (
            <SelectField id="tank-fabric" value={field.value} onChange={field.onChange} placeholder="None" allowNone="None"
              options={fabrics.map((f) => ({ value: String(f.id), label: f.material_type }))} />
          )} />
        </Field>
        <Field id="tank_status" label="Status" error={errors.tank_status?.message}>
          <Controller control={form.control} name="tank_status" render={({ field }) => (
            <SelectField id="tank_status" value={field.value} onChange={field.onChange} placeholder="Status"
              options={TANK_STATUSES.map((s) => ({ value: s, label: s }))} />
          )} />
        </Field>
      </div>
    </FormDialog>
  )
}

// ─── Chemical ───────────────────────────────────────────────────────────────

type ChemicalDialogProps = DialogProps<Chemical> & { suppliers: SupplierOption[] }

export function ChemicalDialog(props: ChemicalDialogProps) {
  return props.open ? <ChemicalDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function ChemicalDialogBody({ open, onOpenChange, record, suppliers }: ChemicalDialogProps) {
  const save = useSave<Chemical>("decolorization/chemicals", { noun: "Chemical" })
  const [formError, setFormError] = useState("")
  const form = useForm<ChemicalForm>({
    resolver: zodResolver(chemicalSchema),
    defaultValues: {
      chemical_name: record?.chemical_name ?? "",
      total_stock: record?.total_stock ?? "",
      unit_of_measure: (UNITS_OF_MEASURE as readonly string[]).includes(record?.unit_of_measure ?? "")
        ? (record!.unit_of_measure as ChemicalForm["unit_of_measure"])
        : "Liters",
      unit_cost: record && Number(record.unit_cost) ? record.unit_cost : "",
      supplier: record?.supplier ? String(record.supplier) : "",
      hazard_class: record?.hazard_class ?? "",
      handling_notes: record?.handling_notes ?? "",
      sds_reference: record?.sds_reference ?? "",
      is_restricted: record?.is_restricted ? "yes" : "no",
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
          unit_cost: values.unit_cost || "0",
          supplier: values.supplier ? Number(values.supplier) : null,
          is_restricted: values.is_restricted === "yes",
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit chemical" : "Add chemical"}
      description={record
        ? `Remaining: ${Number(record.remaining_stock).toLocaleString()} ${record.unit_of_measure}. Raising the total stock (a restock) raises the remaining amount by the same quantity.`
        : "Remaining stock starts equal to the total and goes down with each issuance."}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="chemical_name" label="Chemical name" error={errors.chemical_name?.message}>
        <Input id="chemical_name" placeholder="e.g. Hydrogen Peroxide" aria-invalid={!!errors.chemical_name} {...form.register("chemical_name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="total_stock" label="Total stock" error={errors.total_stock?.message}>
          <Input id="total_stock" inputMode="decimal" aria-invalid={!!errors.total_stock} {...form.register("total_stock")} />
        </Field>
        <Field id="unit_of_measure" label="Unit of measure">
          <Controller control={form.control} name="unit_of_measure" render={({ field }) => (
            <SelectField id="unit_of_measure" value={field.value} onChange={field.onChange} placeholder="Unit"
              options={UNITS_OF_MEASURE.map((u) => ({ value: u, label: u }))} />
          )} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="chemical-cost" label="Cost per unit (Rs.)" hint="Receiving a lot updates it" error={errors.unit_cost?.message}>
          <Input id="chemical-cost" inputMode="decimal" aria-invalid={!!errors.unit_cost} {...form.register("unit_cost")} />
        </Field>
        <Field id="chemical-supplier" label="Usual supplier">
          <Controller control={form.control} name="supplier" render={({ field }) => (
            <SelectField id="chemical-supplier" value={field.value} onChange={field.onChange} placeholder="None" allowNone="None"
              options={supplierOptions(suppliers, record?.supplier)} />
          )} />
        </Field>
      </div>
      <FieldGroup title="Safety">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="hazard_class" label="Hazard class" error={errors.hazard_class?.message}>
            <Input id="hazard_class" list="hazard-classes" placeholder="e.g. Corrosive" {...form.register("hazard_class")} />
            <datalist id="hazard-classes">{HAZARD_CLASSES.map((h) => <option key={h} value={h} />)}</datalist>
          </Field>
          <Field id="is_restricted" label="Who may issue it">
            <Controller control={form.control} name="is_restricted" render={({ field }) => (
              <SelectField id="is_restricted" value={field.value} onChange={field.onChange} placeholder="Select"
                options={[{ value: "no", label: "Supervisors and admins" }, { value: "yes", label: "Admins only (restricted)" }]} />
            )} />
          </Field>
        </div>
        <Field id="sds_reference" label="Safety data sheet" hint="A link, or where the sheet is filed" error={errors.sds_reference?.message}>
          <Input id="sds_reference" placeholder="e.g. https://… or Safety binder, shelf 2" {...form.register("sds_reference")} />
        </Field>
        <Field id="handling_notes" label="Handling notes">
          <Textarea id="handling_notes" rows={2} placeholder="e.g. Gloves and goggles. Store away from heat." {...form.register("handling_notes")} />
        </Field>
      </FieldGroup>
    </FormDialog>
  )
}

// ─── Chemical issuance ──────────────────────────────────────────────────────

type IssuanceDialogProps = DialogProps<ChemicalIssuance> & { chemicals: Chemical[]; tanks: Tank[]; users: UserSummary[] }

export function IssuanceDialog(props: IssuanceDialogProps) {
  return props.open ? <IssuanceDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function IssuanceDialogBody({ open, onOpenChange, record, chemicals, tanks, users }: IssuanceDialogProps) {
  const save = useSave<ChemicalIssuance>("decolorization/issuances", {
    noun: "Chemical issuance",
    invalidate: [["decolorization/chemicals"], ["decolorization/sessions"], ["decolorization/usage"]],
  })
  const [formError, setFormError] = useState("")
  const form = useForm<IssuanceForm>({
    resolver: zodResolver(issuanceSchema),
    defaultValues: {
      chemical: record ? String(record.chemical) : "",
      tank: record ? String(record.tank) : "",
      issued_by: record ? String(record.issued_by) : "",
      quantity: record?.quantity ?? "",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          chemical: Number(values.chemical),
          tank: Number(values.tank),
          quantity: values.quantity,
          notes: values.notes,
          ...(values.issued_by ? { issued_by: Number(values.issued_by) } : {}),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit chemical issuance" : "Issue chemical"}
      description="Taking chemical out of stock for a tank. It is added to the batch running in that tank. Editing or deleting an issuance puts the stock back."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Issue"} onSubmit={onSubmit}>
      <Field id="chemical" label="Chemical" error={errors.chemical?.message}>
        <Controller control={form.control} name="chemical" render={({ field }) => (
          <SelectField id="chemical" value={field.value} onChange={field.onChange} invalid={!!errors.chemical}
            placeholder="Select chemical"
            options={chemicals.map((c) => ({
              value: String(c.id),
              label: `${c.chemical_name} — ${Number(c.remaining_stock).toLocaleString()} ${c.unit_of_measure} left${c.is_restricted ? " (restricted)" : ""}`,
            }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="issuance-tank" label="Tank" error={errors.tank?.message}>
          <Controller control={form.control} name="tank" render={({ field }) => (
            <SelectField id="issuance-tank" value={field.value} onChange={field.onChange} invalid={!!errors.tank}
              placeholder="Select tank" options={tanks.map((t) => ({ value: String(t.id), label: `${t.name} — ${t.batch_id}` }))} />
          )} />
        </Field>
        <Field id="quantity" label="Quantity" error={errors.quantity?.message}>
          <Input id="quantity" inputMode="decimal" aria-invalid={!!errors.quantity} {...form.register("quantity")} />
        </Field>
      </div>
      <Field id="issued_by" label="Issued by" hint="Leave empty to record yourself" error={errors.issued_by?.message}>
        <Controller control={form.control} name="issued_by" render={({ field }) => (
          <SelectField id="issued_by" value={field.value} onChange={field.onChange} placeholder="You" allowNone="You"
            options={userOptions(users)} />
        )} />
      </Field>
      <Field id="issuance-notes" label="Notes" error={errors.notes?.message}>
        <Textarea id="issuance-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Decolorization session ─────────────────────────────────────────────────

type SessionDialogProps = DialogProps<DecolorizationSession> & {
  tanks: Tank[]; fabrics: FabricOption[]; users: UserSummary[]; recipes: Recipe[]
}

export function SessionDialog(props: SessionDialogProps) {
  return props.open ? <SessionDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function SessionDialogBody({ open, onOpenChange, record, tanks, fabrics, users, recipes }: SessionDialogProps) {
  const save = useSave<DecolorizationSession>("decolorization/sessions", { noun: "Decolorization session" })
  const [formError, setFormError] = useState("")
  const form = useForm<SessionForm>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      tank: record ? String(record.tank) : "",
      fabric: record ? String(record.fabric) : "",
      supervisor: record ? String(record.supervisor) : "",
      input_quantity: record?.input_quantity ?? "",
      notes: record?.notes ?? "",
      recipe_version: record?.recipe_version ? String(record.recipe_version) : "",
      temperature_c: record?.temperature_c ?? "",
      duration_minutes: record?.duration_minutes != null ? String(record.duration_minutes) : "",
      water_liters: record?.water_liters ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState
  // The current version of each recipe in use, plus the version already on this session
  const recipeOptions = recipes.flatMap((r) => r.versions
    .filter((v, i) => (i === 0 && r.is_active) || v.id === record?.recipe_version)
    .map((v) => ({ value: String(v.id), label: `${r.name} v${v.version}${r.material_type ? ` — ${r.material_type}` : ""}` })))

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values, tank: Number(values.tank), fabric: Number(values.fabric), supervisor: Number(values.supervisor),
          recipe_version: values.recipe_version ? Number(values.recipe_version) : null,
          temperature_c: orNull(values.temperature_c),
          duration_minutes: values.duration_minutes ? Number(values.duration_minutes) : null,
          water_liters: orNull(values.water_liters),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit decolorization session" : "Start decolorization session"}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Start session"} onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="session-tank" label="Tank" error={errors.tank?.message}>
          <Controller control={form.control} name="tank" render={({ field }) => (
            <SelectField id="session-tank" value={field.value} onChange={field.onChange} invalid={!!errors.tank}
              placeholder="Select tank" options={tanks.map((t) => ({ value: String(t.id), label: `${t.name} — ${t.batch_id}` }))} />
          )} />
        </Field>
        <Field id="session-fabric" label="Fabric lot" error={errors.fabric?.message}>
          <Controller control={form.control} name="fabric" render={({ field }) => (
            <SelectField id="session-fabric" value={field.value} onChange={field.onChange} invalid={!!errors.fabric}
              placeholder="Select fabric lot" options={fabrics.map((f) => ({ value: String(f.id), label: f.material_type }))} />
          )} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="session-supervisor" label="Supervisor" error={errors.supervisor?.message}>
          <Controller control={form.control} name="supervisor" render={({ field }) => (
            <SelectField id="session-supervisor" value={field.value} onChange={field.onChange} invalid={!!errors.supervisor}
              placeholder="Select supervisor" options={userOptions(users)} />
          )} />
        </Field>
        <Field id="input_quantity" label="Input quantity (kg)" error={errors.input_quantity?.message}>
          <Input id="input_quantity" inputMode="decimal" aria-invalid={!!errors.input_quantity} {...form.register("input_quantity")} />
        </Field>
      </div>
      <FieldGroup title="Process (optional)">
        <Field id="session-recipe" label="Recipe" hint="Sets the planned chemicals for this batch">
          <Controller control={form.control} name="recipe_version" render={({ field }) => (
            <SelectField id="session-recipe" value={field.value} onChange={field.onChange} placeholder="None" allowNone="None"
              options={recipeOptions} />
          )} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="session-temperature" label="Temperature, °C" error={errors.temperature_c?.message}>
            <Input id="session-temperature" inputMode="decimal" aria-invalid={!!errors.temperature_c} {...form.register("temperature_c")} />
          </Field>
          <Field id="session-duration" label="Duration, minutes" error={errors.duration_minutes?.message}>
            <Input id="session-duration" inputMode="numeric" aria-invalid={!!errors.duration_minutes} {...form.register("duration_minutes")} />
          </Field>
          <Field id="session-water" label="Water, liters" error={errors.water_liters?.message}>
            <Input id="session-water" inputMode="decimal" aria-invalid={!!errors.water_liters} {...form.register("water_liters")} />
          </Field>
        </div>
      </FieldGroup>
      <Field id="session-notes" label="Notes" error={errors.notes?.message}>
        <Textarea id="session-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Complete a session ─────────────────────────────────────────────────────

export function CompleteDialog({ session, onOpenChange }: { session: DecolorizationSession | null; onOpenChange: (open: boolean) => void }) {
  return session ? <CompleteDialogBody key={session.id} session={session} onOpenChange={onOpenChange} /> : null
}

function CompleteDialogBody({ session, onOpenChange }: { session: DecolorizationSession; onOpenChange: (open: boolean) => void }) {
  const complete = useAction<CompleteForm>("decolorization/sessions", "complete", {
    success: "Decolorization session completed.",
    invalidate: [["decolorization/tanks"]],
  })
  const [formError, setFormError] = useState("")
  const form = useForm<CompleteForm>({ resolver: zodResolver(completeSchema), defaultValues: { output_quantity: "", waste_quantity: "0" } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await complete.mutateAsync({ id: session.id, body: values })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["output_quantity", "waste_quantity"]))
    }
  })

  return (
    <FormDialog open onOpenChange={onOpenChange} title="Complete decolorization session"
      description={`${session.tank_name} · ${session.fabric_material} · ${kg(session.input_quantity)} in. Output plus waste can't exceed that.`}
      error={formError} submitting={isSubmitting} submitLabel="Mark complete" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="output_quantity" label="Output (kg)" error={errors.output_quantity?.message}>
          <Input id="output_quantity" inputMode="decimal" autoFocus aria-invalid={!!errors.output_quantity} {...form.register("output_quantity")} />
        </Field>
        <Field id="waste_quantity" label="Waste (kg)" error={errors.waste_quantity?.message}>
          <Input id="waste_quantity" inputMode="decimal" aria-invalid={!!errors.waste_quantity} {...form.register("waste_quantity")} />
        </Field>
      </div>
    </FormDialog>
  )
}
