"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Controller, type FieldErrors, useFieldArray, useForm } from "react-hook-form"

import { Field, FieldGroup, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { today } from "@/features/procurement/schemas"
import { useAction, useSave } from "@/lib/crud"
import { kg } from "@/lib/format"
import { applyServerErrors } from "@/lib/forms"
import type {
  Bom, Chemical, FabricLot, FactoryUnit, MaterialUse, OrderStep, ProcessStage, ProductionOrder, Routing, UserSummary,
} from "@/types/api"
import {
  type AssignStepForm, type BomForm, type CompleteStepForm, type OrderForm, PRIORITIES, type RoutingForm,
  STAGE_MODULES, type StageForm, assignStepSchema, bomSchema, completeStepSchema, orderSchema, routingSchema,
  stageSchema,
} from "./schemas"

// Everything a change to an order, step or plan can affect
export const PRODUCTION_LISTS = [
  ["production/orders"], ["production/routings"], ["production/boms"], ["production/stages"],
  ["production/summary"], ["production/requirements"],
]

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

const orZero = (v: string) => (v ? v : "0")
const ACTIVE = [{ value: "yes", label: "In use" }, { value: "no", label: "Not in use" }]

/** First error message under a row of a field array, if any. */
function rowError(errors: FieldErrors, list: string, index: number): string | undefined {
  const row = (errors[list] as unknown as Record<number, Record<string, { message?: string }>> | undefined)?.[index]
  return row ? Object.values(row).find((e) => e?.message)?.message : undefined
}

// ─── Production order ───────────────────────────────────────────────────────

type OrderDialogProps = DialogProps<ProductionOrder> & {
  lots: FabricLot[]
  routings: Routing[]
  boms: Bom[]
  units: FactoryUnit[]
}

export function OrderDialog(props: OrderDialogProps) {
  return props.open ? <OrderDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function OrderDialogBody({ open, onOpenChange, record, lots, routings, boms, units }: OrderDialogProps) {
  const save = useSave<ProductionOrder>("production/orders", { noun: "Production order", invalidate: PRODUCTION_LISTS })
  const [formError, setFormError] = useState("")
  // After release the plan is fixed; only the schedule may still move
  const released = !!record && record.status !== "Draft"
  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      product_name: record?.product_name ?? "",
      fabric: record ? String(record.fabric) : "",
      routing: record ? String(record.routing) : routings.length === 1 ? String(routings[0].id) : "",
      bom: record?.bom ? String(record.bom) : "",
      unit: record?.unit ? String(record.unit) : "",
      planned_input_kg: record?.planned_input_kg ?? "",
      planned_output_kg: record?.planned_output_kg ?? "",
      planned_start: record?.planned_start ?? today(),
      planned_end: record?.planned_end ?? "",
      priority: record?.priority ?? "Normal",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    const schedule = {
      planned_start: values.planned_start, planned_end: values.planned_end, priority: values.priority,
      notes: values.notes, unit: values.unit ? Number(values.unit) : null,
    }
    try {
      await save.mutateAsync({
        id: record?.id,
        body: released ? schedule : {
          ...values, ...schedule,
          fabric: Number(values.fabric), routing: Number(values.routing), bom: values.bom ? Number(values.bom) : null,
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.number}` : "New production order"}
      description={released
        ? "This order is released: only its dates, priority, unit and notes can still change."
        : "Plan the processing of a fabric lot. Its stages come from the routing; an admin releases it to the floor."}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <Field id="product_name" label="Product" error={errors.product_name?.message}>
        <Input id="product_name" placeholder="e.g. White recycled fibre" disabled={released} aria-invalid={!!errors.product_name} {...form.register("product_name")} />
      </Field>
      <Field id="mo-fabric" label="Fabric lot" error={errors.fabric?.message}>
        <Controller control={form.control} name="fabric" render={({ field }) => (
          <SelectField id="mo-fabric" value={field.value} onChange={field.onChange} invalid={!!errors.fabric} disabled={released}
            placeholder="Select fabric lot"
            options={lots.map((l) => ({ value: String(l.id), label: `#${l.id} · ${l.material_type} · ${kg(l.remaining_quantity)} unsorted${l.quarantined ? " · in quarantine" : ""}` }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="mo-routing" label="Routing" hint="The stages the order goes through" error={errors.routing?.message}>
          <Controller control={form.control} name="routing" render={({ field }) => (
            <SelectField id="mo-routing" value={field.value} onChange={field.onChange} invalid={!!errors.routing} disabled={released}
              placeholder="Select routing"
              options={routings.filter((r) => r.is_active || r.id === record?.routing).map((r) => ({ value: String(r.id), label: r.name }))} />
          )} />
        </Field>
        <Field id="mo-bom" label="Bill of materials" hint="Optional: plans chemicals and other materials">
          <Controller control={form.control} name="bom" render={({ field }) => (
            <SelectField id="mo-bom" value={field.value} onChange={field.onChange} placeholder="None" allowNone="None" disabled={released}
              options={boms.filter((b) => b.is_active || b.id === record?.bom).map((b) => ({ value: String(b.id), label: b.name }))} />
          )} />
        </Field>
        <Field id="planned_input_kg" label="Planned input (kg)" error={errors.planned_input_kg?.message}>
          <Input id="planned_input_kg" inputMode="decimal" disabled={released} aria-invalid={!!errors.planned_input_kg} {...form.register("planned_input_kg")} />
        </Field>
        <Field id="planned_output_kg" label="Planned output (kg)" error={errors.planned_output_kg?.message}>
          <Input id="planned_output_kg" inputMode="decimal" disabled={released} aria-invalid={!!errors.planned_output_kg} {...form.register("planned_output_kg")} />
        </Field>
        <Field id="planned_start" label="Planned start" error={errors.planned_start?.message}>
          <Input id="planned_start" type="date" aria-invalid={!!errors.planned_start} {...form.register("planned_start")} />
        </Field>
        <Field id="planned_end" label="Planned end" error={errors.planned_end?.message}>
          <Input id="planned_end" type="date" aria-invalid={!!errors.planned_end} {...form.register("planned_end")} />
        </Field>
        <Field id="mo-priority" label="Priority">
          <Controller control={form.control} name="priority" render={({ field }) => (
            <SelectField id="mo-priority" value={field.value} onChange={field.onChange} placeholder="Select priority"
              options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
          )} />
        </Field>
        <Field id="mo-unit" label="Factory unit">
          <Controller control={form.control} name="unit" render={({ field }) => (
            <SelectField id="mo-unit" value={field.value} onChange={field.onChange} placeholder="Any unit" allowNone="Any unit"
              options={units.map((u) => ({ value: String(u.id), label: u.name }))} />
          )} />
        </Field>
      </div>
      <Field id="mo-notes" label="Notes">
        <Textarea id="mo-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Complete a step ────────────────────────────────────────────────────────

type StepDialogProps = { step: OrderStep | null; onOpenChange: (o: boolean) => void }

export function CompleteStepDialog({ step, suggestedInput, onOpenChange }: StepDialogProps & { suggestedInput?: string }) {
  return step ? <CompleteStepDialogBody key={step.id} step={step} suggestedInput={suggestedInput} onOpenChange={onOpenChange} /> : null
}

function CompleteStepDialogBody({ step, suggestedInput, onOpenChange }: { step: OrderStep; suggestedInput?: string; onOpenChange: (o: boolean) => void }) {
  const complete = useAction<CompleteStepForm>("production/steps", "complete", { success: `${step.stage_name} completed.`, invalidate: PRODUCTION_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<CompleteStepForm>({
    resolver: zodResolver(completeStepSchema),
    defaultValues: { input_kg: suggestedInput ?? "", output_kg: "", waste_kg: "0", actual_hours: "" },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await complete.mutateAsync({ id: step.id, body: values })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open onOpenChange={onOpenChange} title={`Complete ${step.stage_name}`}
      description={`${step.order_number}: record what went into this stage and what came out. Output plus waste can't exceed the input.`}
      error={formError} submitting={isSubmitting} submitLabel="Mark complete" onSubmit={onSubmit}>
      <Field id="step-input" label="Input (kg)" error={errors.input_kg?.message}>
        <Input id="step-input" inputMode="decimal" aria-invalid={!!errors.input_kg} {...form.register("input_kg")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="step-output" label="Output (kg)" error={errors.output_kg?.message}>
          <Input id="step-output" inputMode="decimal" aria-invalid={!!errors.output_kg} {...form.register("output_kg")} />
        </Field>
        <Field id="step-waste" label="Waste (kg)" error={errors.waste_kg?.message}>
          <Input id="step-waste" inputMode="decimal" aria-invalid={!!errors.waste_kg} {...form.register("waste_kg")} />
        </Field>
      </div>
      <Field id="step-hours" label="Hours worked" hint={`Planned: ${Number(step.planned_hours)} h. Leave empty to use the time since the step was started.`}
        error={errors.actual_hours?.message}>
        <Input id="step-hours" inputMode="decimal" aria-invalid={!!errors.actual_hours} {...form.register("actual_hours")} />
      </Field>
    </FormDialog>
  )
}

// ─── Assign a step (admin) ──────────────────────────────────────────────────

export function AssignStepDialog({ step, users, onOpenChange }: StepDialogProps & { users: UserSummary[] }) {
  return step ? <AssignStepDialogBody key={step.id} step={step} users={users} onOpenChange={onOpenChange} /> : null
}

function AssignStepDialogBody({ step, users, onOpenChange }: { step: OrderStep; users: UserSummary[]; onOpenChange: (o: boolean) => void }) {
  const save = useSave<OrderStep>("production/steps", { noun: "Step", invalidate: PRODUCTION_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<AssignStepForm>({
    resolver: zodResolver(assignStepSchema),
    defaultValues: {
      operator: step.operator ? String(step.operator) : "",
      machine: step.machine,
      planned_hours: step.planned_hours,
      hourly_cost: step.hourly_cost,
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: step.id,
        body: { operator: values.operator ? Number(values.operator) : null, machine: values.machine,
          planned_hours: orZero(values.planned_hours), hourly_cost: orZero(values.hourly_cost) },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open onOpenChange={onOpenChange} title={`Plan ${step.stage_name}`}
      description={`${step.order_number}: who runs this stage, on which machine, and what an hour of it costs.`}
      error={formError} submitting={isSubmitting} submitLabel="Update" onSubmit={onSubmit}>
      <Field id="step-operator" label="Operator">
        <Controller control={form.control} name="operator" render={({ field }) => (
          <SelectField id="step-operator" value={field.value} onChange={field.onChange} placeholder="Whoever starts it" allowNone="Whoever starts it"
            options={users.map((u) => ({ value: String(u.id), label: u.username }))} />
        )} />
      </Field>
      <Field id="step-machine" label="Machine" hint="e.g. Tank T-03, Dryer D-01" error={errors.machine?.message}>
        <Input id="step-machine" {...form.register("machine")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="step-planned-hours" label="Planned hours" error={errors.planned_hours?.message}>
          <Input id="step-planned-hours" inputMode="decimal" aria-invalid={!!errors.planned_hours} {...form.register("planned_hours")} />
        </Field>
        <Field id="step-hourly-cost" label="Cost per hour (Rs.)" error={errors.hourly_cost?.message}>
          <Input id="step-hourly-cost" inputMode="decimal" aria-invalid={!!errors.hourly_cost} {...form.register("hourly_cost")} />
        </Field>
      </div>
    </FormDialog>
  )
}

// ─── Record material use ────────────────────────────────────────────────────

export function MaterialUseDialog({ material, onOpenChange }: { material: MaterialUse | null; onOpenChange: (o: boolean) => void }) {
  return material ? <MaterialUseDialogBody key={material.id} material={material} onOpenChange={onOpenChange} /> : null
}

function MaterialUseDialogBody({ material, onOpenChange }: { material: MaterialUse; onOpenChange: (o: boolean) => void }) {
  const save = useSave<MaterialUse>("production/materials", { noun: "Material use", invalidate: PRODUCTION_LISTS })
  const [quantity, setQuantity] = useState(material.actual_quantity ?? "")
  const [error, setError] = useState("")
  return (
    <FormDialog open onOpenChange={onOpenChange} title={`Record ${material.material} used`}
      description={`Planned: ${Number(material.planned_quantity)} ${material.unit}. This is a record for the order's cost; chemical stock still moves through issuances.`}
      error={error} submitting={save.isPending} submitLabel="Save"
      onSubmit={async (e) => {
        e.preventDefault()
        setError("")
        if (!/^\d+(\.\d{1,2})?$/.test(quantity.trim())) return setError("Enter the quantity used, as a number with up to 2 decimals.")
        try {
          await save.mutateAsync({ id: material.id, body: { actual_quantity: quantity.trim() } })
          onOpenChange(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save the quantity.")
        }
      }}>
      <Field id="material-actual" label={`Quantity used (${material.unit})`}>
        <Input id="material-actual" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </Field>
    </FormDialog>
  )
}

// ─── Routing ────────────────────────────────────────────────────────────────

export function RoutingDialog(props: DialogProps<Routing> & { stages: ProcessStage[] }) {
  return props.open ? <RoutingDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function RoutingDialogBody({ open, onOpenChange, record, stages }: DialogProps<Routing> & { stages: ProcessStage[] }) {
  const save = useSave<Routing>("production/routings", { noun: "Routing", invalidate: PRODUCTION_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<RoutingForm>({
    resolver: zodResolver(routingSchema),
    defaultValues: {
      name: record?.name ?? "",
      description: record?.description ?? "",
      is_active: record?.is_active === false ? "no" : "yes",
      steps: record?.steps.map((s) => ({ stage: String(s.stage), planned_hours: s.planned_hours, hourly_cost: s.hourly_cost }))
        ?? [{ stage: "", planned_hours: "", hourly_cost: "" }],
    },
  })
  const steps = useFieldArray({ control: form.control, name: "steps" })
  const { errors, isSubmitting } = form.formState
  const usedStages = new Set(record?.steps.map((s) => s.stage))

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values, is_active: values.is_active === "yes",
          steps: values.steps.map((s) => ({ stage: Number(s.stage), planned_hours: orZero(s.planned_hours), hourly_cost: orZero(s.hourly_cost) })),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New routing"}
      description="The stages an order goes through, in order. Orders copy the stages when they are created, so changes here apply to new orders only."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="routing-name" label="Name" error={errors.name?.message}>
          <Input id="routing-name" placeholder="e.g. Standard recycling" aria-invalid={!!errors.name} {...form.register("name")} />
        </Field>
        <Field id="routing-active" label="Status">
          <Controller control={form.control} name="is_active" render={({ field }) => (
            <SelectField id="routing-active" value={field.value} onChange={field.onChange} placeholder="Select status" options={ACTIVE} />
          )} />
        </Field>
      </div>
      <FieldGroup title="Stages, in order">
        <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_auto] gap-2 px-0.5 text-xs text-muted-foreground sm:grid">
          <span>Stage</span><span>Hours</span><span>Rs. per hour</span><span className="w-9" />
        </div>
        {steps.fields.map((step, i) => (
          <div key={step.id} className="space-y-1">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_auto]">
              <Controller control={form.control} name={`steps.${i}.stage`} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="col-span-full w-full sm:col-span-1" aria-label={`Stage ${i + 1}`} aria-invalid={!!errors.steps?.[i]?.stage}>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.filter((s) => s.is_active || usedStages.has(s.id)).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
              <Input aria-label={`Hours ${i + 1}`} placeholder="Hours" inputMode="decimal" aria-invalid={!!errors.steps?.[i]?.planned_hours}
                {...form.register(`steps.${i}.planned_hours`)} />
              <Input aria-label={`Cost per hour ${i + 1} (Rs.)`} placeholder="Rs./h" inputMode="decimal" aria-invalid={!!errors.steps?.[i]?.hourly_cost}
                {...form.register(`steps.${i}.hourly_cost`)} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove stage ${i + 1}`}
                disabled={steps.fields.length === 1} onClick={() => steps.remove(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            {rowError(errors, "steps", i) && <p className="text-[13px] text-destructive">{rowError(errors, "steps", i)}</p>}
          </div>
        ))}
        <Button type="button" variant="outline" className="w-fit" onClick={() => steps.append({ stage: "", planned_hours: "", hourly_cost: "" })}>
          <Plus className="size-4" /> Add stage
        </Button>
        {errors.steps?.root?.message && <p className="text-[13px] text-destructive">{errors.steps.root.message}</p>}
      </FieldGroup>
      <Field id="routing-description" label="Description">
        <Textarea id="routing-description" rows={2} {...form.register("description")} />
      </Field>
    </FormDialog>
  )
}

// ─── Bill of materials ──────────────────────────────────────────────────────

export function BomDialog(props: DialogProps<Bom> & { chemicals: Chemical[] }) {
  return props.open ? <BomDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function BomDialogBody({ open, onOpenChange, record, chemicals }: DialogProps<Bom> & { chemicals: Chemical[] }) {
  const save = useSave<Bom>("production/boms", { noun: "Bill of materials", invalidate: PRODUCTION_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<BomForm>({
    resolver: zodResolver(bomSchema),
    defaultValues: {
      name: record?.name ?? "",
      product_name: record?.product_name ?? "",
      is_active: record?.is_active === false ? "no" : "yes",
      notes: record?.notes ?? "",
      lines: record?.lines.map((l) => ({
        material: l.material, chemical: l.chemical ? String(l.chemical) : "", quantity_per_100kg: l.quantity_per_100kg,
        unit: l.unit, unit_cost: l.unit_cost,
      })) ?? [{ material: "", chemical: "", quantity_per_100kg: "", unit: "kg", unit_cost: "" }],
    },
  })
  const lines = useFieldArray({ control: form.control, name: "lines" })
  const { errors, isSubmitting } = form.formState
  const NONE = "none"

  // Choosing a stocked chemical names the line and takes its unit
  const pickChemical = (index: number, id: string) => {
    const chemical = chemicals.find((c) => String(c.id) === id)
    form.setValue(`lines.${index}.chemical`, chemical ? id : "")
    if (chemical) {
      form.setValue(`lines.${index}.material`, chemical.chemical_name, { shouldValidate: true })
      form.setValue(`lines.${index}.unit`, chemical.unit_of_measure, { shouldValidate: true })
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values, is_active: values.is_active === "yes",
          lines: values.lines.map((l) => ({ ...l, chemical: l.chemical ? Number(l.chemical) : null, unit_cost: orZero(l.unit_cost) })),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New bill of materials"}
      description="What processing 100 kg of input needs. An order multiplies this by its planned input."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="bom-name" label="Name" error={errors.name?.message}>
          <Input id="bom-name" placeholder="e.g. Cotton bleaching" aria-invalid={!!errors.name} {...form.register("name")} />
        </Field>
        <Field id="bom-active" label="Status">
          <Controller control={form.control} name="is_active" render={({ field }) => (
            <SelectField id="bom-active" value={field.value} onChange={field.onChange} placeholder="Select status" options={ACTIVE} />
          )} />
        </Field>
      </div>
      <Field id="bom-product" label="Product" hint="Optional: what this recipe makes" error={errors.product_name?.message}>
        <Input id="bom-product" {...form.register("product_name")} />
      </Field>
      <FieldGroup title="Materials per 100 kg of input">
        {lines.fields.map((line, i) => (
          <div key={line.id} className="space-y-1 rounded-xl border p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <Controller control={form.control} name={`lines.${i}.chemical`} render={({ field }) => (
                <Select value={field.value || NONE} onValueChange={(v) => pickChemical(i, v)}>
                  <SelectTrigger className="w-full" aria-label={`Stocked chemical ${i + 1}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not a stocked chemical</SelectItem>
                    {chemicals.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.chemical_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove material ${i + 1}`}
                disabled={lines.fields.length === 1} onClick={() => lines.remove(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-[minmax(0,1fr)_6rem_5rem_6rem]">
              <Input className="col-span-full sm:col-span-1" aria-label={`Material ${i + 1}`} placeholder="Material" aria-invalid={!!errors.lines?.[i]?.material}
                {...form.register(`lines.${i}.material`)} />
              <Input aria-label={`Quantity ${i + 1}`} placeholder="Quantity" inputMode="decimal" aria-invalid={!!errors.lines?.[i]?.quantity_per_100kg}
                {...form.register(`lines.${i}.quantity_per_100kg`)} />
              <Input aria-label={`Unit ${i + 1}`} placeholder="Unit" aria-invalid={!!errors.lines?.[i]?.unit} {...form.register(`lines.${i}.unit`)} />
              <Input className="col-span-full sm:col-span-1" aria-label={`Cost per unit ${i + 1} (Rs.)`} placeholder="Rs. per unit" inputMode="decimal"
                aria-invalid={!!errors.lines?.[i]?.unit_cost} {...form.register(`lines.${i}.unit_cost`)} />
            </div>
            {rowError(errors, "lines", i) && <p className="text-[13px] text-destructive">{rowError(errors, "lines", i)}</p>}
          </div>
        ))}
        <Button type="button" variant="outline" className="w-fit"
          onClick={() => lines.append({ material: "", chemical: "", quantity_per_100kg: "", unit: "kg", unit_cost: "" })}>
          <Plus className="size-4" /> Add material
        </Button>
        {errors.lines?.root?.message && <p className="text-[13px] text-destructive">{errors.lines.root.message}</p>}
      </FieldGroup>
      <Field id="bom-notes" label="Notes">
        <Textarea id="bom-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Process stage ──────────────────────────────────────────────────────────

export function StageDialog(props: DialogProps<ProcessStage>) {
  return props.open ? <StageDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function StageDialogBody({ open, onOpenChange, record }: DialogProps<ProcessStage>) {
  const save = useSave<ProcessStage>("production/stages", { noun: "Stage", invalidate: PRODUCTION_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<StageForm>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: record?.name ?? "",
      sequence: record ? String(record.sequence) : "",
      module: record?.module ?? "",
      is_active: record?.is_active === false ? "no" : "yes",
    },
  })
  const { errors, isSubmitting } = form.formState
  const NONE = "none"

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, sequence: Number(values.sequence), is_active: values.is_active === "yes" } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New process stage"}
      description="A kind of processing step that routings can use."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="stage-name" label="Name" error={errors.name?.message}>
        <Input id="stage-name" placeholder="e.g. Baling" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="stage-sequence" label="Usual position" hint="Lower numbers come first" error={errors.sequence?.message}>
          <Input id="stage-sequence" inputMode="numeric" aria-invalid={!!errors.sequence} {...form.register("sequence")} />
        </Field>
        <Field id="stage-active" label="Status">
          <Controller control={form.control} name="is_active" render={({ field }) => (
            <SelectField id="stage-active" value={field.value} onChange={field.onChange} placeholder="Select status" options={ACTIVE} />
          )} />
        </Field>
      </div>
      <Field id="stage-module" label="Done in" hint="The module whose sessions do this work, if there is one">
        <Controller control={form.control} name="module" render={({ field }) => (
          <SelectField id="stage-module" value={field.value || NONE} onChange={(v) => field.onChange(v === NONE ? "" : v)} placeholder="Select module"
            options={STAGE_MODULES.map((m) => ({ value: m.value || NONE, label: m.label }))} />
        )} />
      </Field>
    </FormDialog>
  )
}
