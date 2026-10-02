"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { Field, FieldGroup, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { today } from "@/features/procurement/schemas"
import { useSave } from "@/lib/crud"
import { applyServerErrors } from "@/lib/forms"
import type { FabricLot } from "@/types/api"
import type { SustainabilityTarget, UtilityReading, WasteCategory, WasteRecord } from "@/types/sustainability"
import {
  CLASSIFICATION_LABELS, CLASSIFICATIONS, type CategoryForm, DIRECTIONS, METHODS, METRIC_LABELS, METRIC_UNITS, METRICS,
  type ReadingForm, STAGES, type TargetForm, UTILITIES, UTILITY_UNITS, type WasteForm,
  categorySchema, readingSchema, targetSchema, wasteSchema,
} from "./schemas"

// Every list and figure of the module: a new record or reading changes the dashboard and the report
export const SUSTAINABILITY_LISTS = [
  ["sustainability/waste-records"], ["sustainability/utility-readings"], ["sustainability/waste-categories"],
  ["sustainability/targets"], ["sustainability/summary"], ["sustainability/report"],
]

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

const money = (v: string | undefined) => (v && Number(v) ? v : "")
const IN_USE = [{ value: "yes", label: "In use" }, { value: "no", label: "Not in use" }]

// ─── Waste record ───────────────────────────────────────────────────────────

type WasteDialogProps = DialogProps<WasteRecord> & { categories: WasteCategory[]; lots: FabricLot[] }

export function WasteDialog(props: WasteDialogProps) {
  return props.open ? <WasteDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function WasteDialogBody({ open, onOpenChange, record, categories, lots }: WasteDialogProps) {
  const save = useSave<WasteRecord>("sustainability/waste-records", { noun: "Waste record", invalidate: SUSTAINABILITY_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<WasteForm>({
    resolver: zodResolver(wasteSchema),
    defaultValues: {
      date: record?.date ?? today(),
      category: record ? String(record.category) : "",
      stage: record?.stage ?? "Sorting",
      quantity_kg: record?.quantity_kg ?? "",
      fabric: record?.fabric ? String(record.fabric) : "",
      disposal_method: record?.disposal_method ?? "",
      disposed_to: record?.disposed_to ?? "",
      disposal_cost: money(record?.disposal_cost),
      revenue: money(record?.revenue),
      disposal_reference: record?.disposal_reference ?? "",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const usable = categories.filter((c) => c.is_active || c.id === record?.category)

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          category: Number(values.category),
          fabric: values.fabric ? Number(values.fabric) : null,
          disposal_cost: values.disposal_cost || "0",
          revenue: values.revenue || "0",
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit waste record" : "Add waste record"}
      description="Waste or rejected material that was weighed and disposed of. Process loss is worked out from the sessions, so don't enter it here."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="waste-date" label="Date" error={errors.date?.message}>
          <Input id="waste-date" type="date" aria-invalid={!!errors.date} {...form.register("date")} />
        </Field>
        <Field id="waste-quantity" label="Weight (kg)" error={errors.quantity_kg?.message}>
          <Input id="waste-quantity" inputMode="decimal" aria-invalid={!!errors.quantity_kg} {...form.register("quantity_kg")} />
        </Field>
      </div>
      <Field id="waste-category" label="Waste category" error={errors.category?.message}>
        <Controller control={form.control} name="category" render={({ field }) => (
          <SelectField id="waste-category" value={field.value} onChange={field.onChange} invalid={!!errors.category} placeholder="Select category"
            options={usable.map((c) => ({ value: String(c.id), label: `${c.name} · ${CLASSIFICATION_LABELS[c.classification]}` }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="waste-stage" label="Where it came from">
          <Controller control={form.control} name="stage" render={({ field }) => (
            <SelectField id="waste-stage" value={field.value} onChange={field.onChange} placeholder="Select stage"
              options={STAGES.map((s) => ({ value: s, label: s }))} />
          )} />
        </Field>
        <Field id="waste-fabric" label="Fabric lot" hint="Optional">
          <Controller control={form.control} name="fabric" render={({ field }) => (
            <SelectField id="waste-fabric" value={field.value} onChange={field.onChange} placeholder="None" allowNone="None"
              options={lots.map((l) => ({ value: String(l.id), label: `#${l.id} · ${l.material_type} · ${l.stock_vendor}` }))} />
          )} />
        </Field>
      </div>
      <FieldGroup title="Disposal">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="waste-method" label="Disposal method" error={errors.disposal_method?.message}>
            <Controller control={form.control} name="disposal_method" render={({ field }) => (
              <SelectField id="waste-method" value={field.value} onChange={field.onChange} invalid={!!errors.disposal_method}
                placeholder="Select method" options={METHODS.map((m) => ({ value: m, label: m }))} />
            )} />
          </Field>
          <Field id="waste-to" label="Taken by" hint="Recycler, buyer or contractor" error={errors.disposed_to?.message}>
            <Input id="waste-to" {...form.register("disposed_to")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="waste-cost" label="Disposal cost (Rs.)" error={errors.disposal_cost?.message}>
            <Input id="waste-cost" inputMode="decimal" aria-invalid={!!errors.disposal_cost} {...form.register("disposal_cost")} />
          </Field>
          <Field id="waste-revenue" label="Sold for (Rs.)" error={errors.revenue?.message}>
            <Input id="waste-revenue" inputMode="decimal" aria-invalid={!!errors.revenue} {...form.register("revenue")} />
          </Field>
        </div>
        <Field id="waste-reference" label="Manifest or gate pass no." error={errors.disposal_reference?.message}>
          <Input id="waste-reference" {...form.register("disposal_reference")} />
        </Field>
      </FieldGroup>
      <Field id="waste-notes" label="Notes">
        <Textarea id="waste-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Utility reading ────────────────────────────────────────────────────────

export function ReadingDialog(props: DialogProps<UtilityReading>) {
  return props.open ? <ReadingDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function ReadingDialogBody({ open, onOpenChange, record }: DialogProps<UtilityReading>) {
  const save = useSave<UtilityReading>("sustainability/utility-readings", { noun: "Reading", invalidate: SUSTAINABILITY_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<ReadingForm>({
    resolver: zodResolver(readingSchema),
    defaultValues: {
      date: record?.date ?? today(),
      utility: record?.utility ?? "Water",
      quantity: record?.quantity ?? "",
      cost: money(record?.cost),
      stage: record?.stage ?? "",
      meter_reference: record?.meter_reference ?? "",
      notes: record?.notes ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const utility = useWatch({ control: form.control, name: "utility" })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: { ...values, cost: values.cost || "0" } })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit reading" : "Add utility reading"}
      description="How much was used since the last reading, from the meter or the bill."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="reading-utility" label="Utility" error={errors.utility?.message}>
          <Controller control={form.control} name="utility" render={({ field }) => (
            <SelectField id="reading-utility" value={field.value} onChange={field.onChange} placeholder="Select utility"
              options={UTILITIES.map((u) => ({ value: u, label: `${u} (${UTILITY_UNITS[u]})` }))} />
          )} />
        </Field>
        <Field id="reading-date" label="Date" error={errors.date?.message}>
          <Input id="reading-date" type="date" aria-invalid={!!errors.date} {...form.register("date")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="reading-quantity" label="Quantity used" hint={`In ${UTILITY_UNITS[utility]}`} error={errors.quantity?.message}>
          <Input id="reading-quantity" inputMode="decimal" aria-invalid={!!errors.quantity} {...form.register("quantity")} />
        </Field>
        <Field id="reading-cost" label="Cost (Rs.)" error={errors.cost?.message}>
          <Input id="reading-cost" inputMode="decimal" aria-invalid={!!errors.cost} {...form.register("cost")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="reading-stage" label="Area">
          <Controller control={form.control} name="stage" render={({ field }) => (
            <SelectField id="reading-stage" value={field.value} onChange={field.onChange} placeholder="Whole factory" allowNone="Whole factory"
              options={STAGES.map((s) => ({ value: s, label: s }))} />
          )} />
        </Field>
        <Field id="reading-meter" label="Meter or bill no." error={errors.meter_reference?.message}>
          <Input id="reading-meter" {...form.register("meter_reference")} />
        </Field>
      </div>
      <Field id="reading-notes" label="Notes">
        <Textarea id="reading-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Waste category ─────────────────────────────────────────────────────────

export function CategoryDialog(props: DialogProps<WasteCategory>) {
  return props.open ? <CategoryDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function CategoryDialogBody({ open, onOpenChange, record }: DialogProps<WasteCategory>) {
  const save = useSave<WasteCategory>("sustainability/waste-categories", { noun: "Waste category", invalidate: SUSTAINABILITY_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: record?.name ?? "",
      classification: record?.classification ?? "Recyclable",
      description: record?.description ?? "",
      is_active: record?.is_active === false ? "no" : "yes",
    },
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
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New waste category"}
      description="A kind of waste. Its classification decides how its records are grouped in the report."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="category-name" label="Name" error={errors.name?.message}>
        <Input id="category-name" placeholder="e.g. Fibre dust" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="category-classification" label="Classification">
          <Controller control={form.control} name="classification" render={({ field }) => (
            <SelectField id="category-classification" value={field.value} onChange={field.onChange} placeholder="Select classification"
              options={CLASSIFICATIONS.map((c) => ({ value: c, label: CLASSIFICATION_LABELS[c] }))} />
          )} />
        </Field>
        <Field id="category-active" label="Status">
          <Controller control={form.control} name="is_active" render={({ field }) => (
            <SelectField id="category-active" value={field.value} onChange={field.onChange} placeholder="Select status" options={IN_USE} />
          )} />
        </Field>
      </div>
      <Field id="category-description" label="Description">
        <Textarea id="category-description" rows={2} {...form.register("description")} />
      </Field>
    </FormDialog>
  )
}

// ─── Target ─────────────────────────────────────────────────────────────────

export function TargetDialog(props: DialogProps<SustainabilityTarget>) {
  return props.open ? <TargetDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function TargetDialogBody({ open, onOpenChange, record }: DialogProps<SustainabilityTarget>) {
  const save = useSave<SustainabilityTarget>("sustainability/targets", { noun: "Target", invalidate: SUSTAINABILITY_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<TargetForm>({
    resolver: zodResolver(targetSchema),
    defaultValues: {
      metric: record?.metric ?? "recovery_rate",
      direction: record?.direction ?? "At least",
      target_value: record?.target_value ?? "",
      period: record?.period ?? String(new Date().getFullYear()),
      is_active: record?.is_active === false ? "no" : "yes",
    },
  })
  const { errors, isSubmitting } = form.formState
  const metric = useWatch({ control: form.control, name: "metric" })

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
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit target" : "New target"}
      description="A goal for one calculated figure. The dashboard shows whether the chosen period meets it."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="target-metric" label="Figure" error={errors.metric?.message}>
        <Controller control={form.control} name="metric" render={({ field }) => (
          <SelectField id="target-metric" value={field.value} invalid={!!errors.metric} placeholder="Select figure"
            onChange={(v) => {
              field.onChange(v)
              // A recovery rate should be high; the other figures should be low
              form.setValue("direction", v === "recovery_rate" ? "At least" : "At most")
            }}
            options={METRICS.map((m) => ({ value: m, label: METRIC_LABELS[m] }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="target-direction" label="Should be">
          <Controller control={form.control} name="direction" render={({ field }) => (
            <SelectField id="target-direction" value={field.value} onChange={field.onChange} placeholder="Select"
              options={DIRECTIONS.map((d) => ({ value: d, label: d }))} />
          )} />
        </Field>
        <Field id="target-value" label="Target" hint={`In ${METRIC_UNITS[metric]}`} error={errors.target_value?.message}>
          <Input id="target-value" inputMode="decimal" aria-invalid={!!errors.target_value} {...form.register("target_value")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="target-period" label="Period" hint="A label, e.g. the year" error={errors.period?.message}>
          <Input id="target-period" {...form.register("period")} />
        </Field>
        <Field id="target-active" label="Status">
          <Controller control={form.control} name="is_active" render={({ field }) => (
            <SelectField id="target-active" value={field.value} onChange={field.onChange} placeholder="Select status" options={IN_USE} />
          )} />
        </Field>
      </div>
    </FormDialog>
  )
}
