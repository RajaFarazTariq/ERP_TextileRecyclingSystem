"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import { Controller, type FieldErrors, useFieldArray, useForm, useWatch } from "react-hook-form"

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
import { cn } from "@/lib/utils"
import type {
  CorrectiveAction, FabricLot, Inspection, QualityStage, QualityStandard, StockEntry, UserSummary,
} from "@/types/api"
import {
  ACTION_KINDS, type ActionForm, CHECK_KINDS, type InspectionForm, RESULTS, STAGE_LABELS, STAGES, type StandardForm,
  actionSchema, inspectionSchema, limitText, rowPassed, standardSchema,
} from "./schemas"

// Lists that show quality data: a result or release changes what warehouse, sorting and sales may use
export const QUALITY_LISTS = [
  ["quality/inspections"], ["quality/actions"], ["quality/standards"], ["quality/summary"],
  ["warehouse/stock"], ["sorting/fabric-stock"], ["procurement/supplier-performance"],
]

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

const orNull = (v: string) => (v ? v : null)

/** First error message under a row of a field array, if any. */
function rowError(errors: FieldErrors, list: string, index: number): string | undefined {
  const row = (errors[list] as unknown as Record<number, Record<string, { message?: string }>> | undefined)?.[index]
  return row ? Object.values(row).find((e) => e?.message)?.message : undefined
}

// ─── Inspection ─────────────────────────────────────────────────────────────

type InspectionDialogProps = DialogProps<Inspection> & {
  /** Stages this user may inspect */
  stages: QualityStage[]
  deliveries: StockEntry[]
  lots: FabricLot[]
  standards: QualityStandard[]
}

export function InspectionDialog(props: InspectionDialogProps) {
  return props.open ? <InspectionDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function InspectionDialogBody({ open, onOpenChange, record, stages, deliveries, lots, standards }: InspectionDialogProps) {
  const save = useSave<Inspection>("quality/inspections", { noun: "Inspection", invalidate: QUALITY_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<InspectionForm>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      stage: record?.stage ?? stages[0] ?? "Incoming",
      stock: record?.stock ? String(record.stock) : "",
      fabric: record?.fabric ? String(record.fabric) : "",
      standard: record?.standard ? String(record.standard) : "",
      inspected_on: record?.inspected_on ?? today(),
      sample_kg: record?.sample_kg ?? "",
      composition: record?.composition ?? "",
      result: record?.result ?? "Pass",
      rejection_reason: record?.rejection_reason ?? "",
      notes: record?.notes ?? "",
      results: record?.results.map((r) => ({
        name: r.name, kind: r.kind, unit: r.unit, min_value: r.min_value ?? "", max_value: r.max_value ?? "",
        value: r.value ?? "", passed: r.kind === "Pass/Fail" ? (r.passed ? "yes" as const : "no" as const) : "" as const, custom: false,
      })) ?? [],
    },
  })
  const rows = useFieldArray({ control: form.control, name: "results" })
  const { errors, isSubmitting } = form.formState
  const [stage, result, watched] = useWatch({ control: form.control, name: ["stage", "result", "results"] })
  const failed = (watched ?? []).filter((r) => rowPassed(r) === false).length
  const stageStandards = standards.filter((s) => s.stage === stage && (s.is_active || s.id === record?.standard))

  const applyStandard = (id: string) => {
    form.setValue("standard", id)
    const standard = standards.find((s) => String(s.id) === id)
    rows.replace((standard?.checks ?? []).map((c) => ({
      name: c.name, kind: c.kind, unit: c.unit, min_value: c.min_value ?? "", max_value: c.max_value ?? "",
      value: "", passed: "" as const, custom: false,
    })))
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          stock: values.stage === "Incoming" ? Number(values.stock) : null,
          fabric: values.stage === "Incoming" ? null : Number(values.fabric),
          standard: values.standard ? Number(values.standard) : null,
          sample_kg: orNull(values.sample_kg),
          results: values.results.map((r) => ({
            name: r.name, kind: r.kind, unit: r.unit, min_value: orNull(r.min_value), max_value: orNull(r.max_value),
            value: r.kind === "Measure" ? r.value : null,
            passed: r.kind === "Pass/Fail" ? r.passed === "yes" : null,
          })),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.number}` : "Record inspection"}
      description="Material that fails goes into quarantine: it can't be processed or sold until an admin releases it."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="qc-stage" label="Stage" error={errors.stage?.message}>
          <Controller control={form.control} name="stage" render={({ field }) => (
            <SelectField id="qc-stage" value={field.value} placeholder="Select stage"
              onChange={(v) => { field.onChange(v); applyStandard("") }}
              options={stages.map((s) => ({ value: s, label: STAGE_LABELS[s] }))} />
          )} />
        </Field>
        <Field id="inspected_on" label="Inspected on" error={errors.inspected_on?.message}>
          <Input id="inspected_on" type="date" {...form.register("inspected_on")} />
        </Field>
      </div>
      {stage === "Incoming" ? (
        <Field id="qc-stock" label="Delivery" error={errors.stock?.message}>
          <Controller control={form.control} name="stock" render={({ field }) => (
            <SelectField id="qc-stock" value={field.value} onChange={field.onChange} invalid={!!errors.stock} placeholder="Select delivery"
              options={deliveries.map((d) => ({ value: String(d.id), label: `#${d.id} · ${d.fabric_type} · ${d.vendor_name} · ${kg(d.our_weight)}` }))} />
          )} />
        </Field>
      ) : (
        <Field id="qc-fabric" label="Fabric lot" error={errors.fabric?.message}>
          <Controller control={form.control} name="fabric" render={({ field }) => (
            <SelectField id="qc-fabric" value={field.value} onChange={field.onChange} invalid={!!errors.fabric} placeholder="Select fabric lot"
              options={lots.map((l) => ({ value: String(l.id), label: `#${l.id} · ${l.material_type} · ${l.stock_vendor}` }))} />
          )} />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="qc-standard" label="Standard" hint="Fills in the checklist and its limits">
          <Controller control={form.control} name="standard" render={({ field }) => (
            <SelectField id="qc-standard" value={field.value} onChange={applyStandard} placeholder="No standard" allowNone="No standard"
              options={stageStandards.map((s) => ({ value: String(s.id), label: s.material_type ? `${s.name} (${s.material_type})` : s.name }))} />
          )} />
        </Field>
        <Field id="sample_kg" label="Sample (kg)" error={errors.sample_kg?.message}>
          <Input id="sample_kg" inputMode="decimal" {...form.register("sample_kg")} />
        </Field>
      </div>
      <Field id="composition" label="Composition found" hint="e.g. 80% cotton / 20% polyester" error={errors.composition?.message}>
        <Input id="composition" {...form.register("composition")} />
      </Field>

      <FieldGroup title="Checklist">
        {rows.fields.length === 0 && (
          <p className="text-sm text-muted-foreground">Choose a standard to load its checks, or add your own.</p>
        )}
        {rows.fields.map((row, i) => {
          const current = watched?.[i] ?? row
          const passed = rowPassed(current)
          const limit = limitText(current)
          return (
            <div key={row.id} className="space-y-1">
              <div className="grid grid-cols-[1fr_8.5rem_4.5rem_auto] items-center gap-2">
                {row.custom ? (
                  <Input aria-label={`Check ${i + 1} name`} placeholder="e.g. No oil stains" {...form.register(`results.${i}.name`)} />
                ) : (
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-medium">{row.name}</span>
                    {limit && <span className="block text-xs text-muted-foreground">{limit}</span>}
                  </span>
                )}
                {row.kind === "Measure" ? (
                  <Input aria-label={`${current.name || `Check ${i + 1}`} value`} placeholder={row.unit || "value"} inputMode="decimal"
                    aria-invalid={!!errors.results?.[i]?.value} {...form.register(`results.${i}.value`)} />
                ) : (
                  <Controller control={form.control} name={`results.${i}.passed`} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full" aria-label={`${current.name || `Check ${i + 1}`} result`} aria-invalid={!!errors.results?.[i]?.passed}>
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Passed</SelectItem>
                        <SelectItem value="no">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                )}
                <span className={cn("inline-flex items-center gap-1 text-xs font-medium",
                  passed === null ? "text-faint" : passed ? "text-success-fg" : "text-danger-fg")}>
                  {passed === null ? "—" : passed ? <><Check className="size-3.5" aria-hidden /> Pass</> : <><X className="size-3.5" aria-hidden /> Fail</>}
                </span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove check ${i + 1}`} onClick={() => rows.remove(i)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {rowError(errors, "results", i) && <p className="text-[13px] text-destructive">{rowError(errors, "results", i)}</p>}
            </div>
          )
        })}
        <Button type="button" variant="outline" className="w-fit"
          onClick={() => rows.append({ name: "", kind: "Pass/Fail", unit: "", min_value: "", max_value: "", value: "", passed: "", custom: true })}>
          <Plus className="size-4" /> Add check
        </Button>
      </FieldGroup>

      <Field id="qc-result" label="Result" error={errors.result?.message}
        hint={failed ? `${failed} check${failed === 1 ? "" : "s"} failed: choose Conditional or Fail.` : undefined}>
        <Controller control={form.control} name="result" render={({ field }) => (
          <SelectField id="qc-result" value={field.value} onChange={field.onChange} invalid={!!errors.result} placeholder="Select result"
            options={RESULTS.map((r) => ({ value: r, label: r === "Conditional" ? "Conditional (accepted with a condition)" : r === "Fail" ? "Fail (quarantine)" : r }))} />
        )} />
      </Field>
      {result === "Fail" && (
        <Field id="rejection_reason" label="Why it failed" error={errors.rejection_reason?.message}>
          <Textarea id="rejection_reason" rows={2} aria-invalid={!!errors.rejection_reason} {...form.register("rejection_reason")} />
        </Field>
      )}
      <Field id="qc-notes" label={result === "Conditional" ? "Condition" : "Notes"} error={errors.notes?.message}>
        <Textarea id="qc-notes" rows={2} aria-invalid={!!errors.notes} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Release from quarantine ────────────────────────────────────────────────

export function ReleaseDialog({ inspection, onOpenChange }: { inspection: Inspection | null; onOpenChange: (o: boolean) => void }) {
  return inspection ? <ReleaseDialogBody key={inspection.id} inspection={inspection} onOpenChange={onOpenChange} /> : null
}

function ReleaseDialogBody({ inspection, onOpenChange }: { inspection: Inspection; onOpenChange: (o: boolean) => void }) {
  const release = useAction<{ note: string }>("quality/inspections", "release", { success: "Released from quarantine.", invalidate: QUALITY_LISTS })
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  return (
    <FormDialog open onOpenChange={onOpenChange} title={`Release ${inspection.material}?`}
      description={`${inspection.target} failed ${inspection.number}: ${inspection.rejection_reason} Releasing it lets it be processed and sold again.`}
      error={error} submitting={release.isPending} submitLabel="Release"
      onSubmit={async (e) => {
        e.preventDefault()
        setError("")
        if (!note.trim()) return setError("Say why the material is released.")
        try {
          await release.mutateAsync({ id: inspection.id, body: { note } })
          onOpenChange(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not release the material.")
        }
      }}>
      <Field id="release-note" label="Reason for release" hint="e.g. dried and re-tested, sorted out the bad part, returned to supplier">
        <Textarea id="release-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormDialog>
  )
}

// ─── Corrective action ──────────────────────────────────────────────────────

type ActionDialogProps = DialogProps<CorrectiveAction> & {
  inspections: Inspection[]
  users: UserSummary[]
  /** Start a new action for this inspection */
  forInspection?: Inspection | null
}

export function ActionDialog(props: ActionDialogProps) {
  return props.open ? <ActionDialogBody key={props.record?.id ?? `new-${props.forInspection?.id ?? ""}`} {...props} /> : null
}

function ActionDialogBody({ open, onOpenChange, record, inspections, users, forInspection }: ActionDialogProps) {
  const save = useSave<CorrectiveAction>("quality/actions", { noun: "Action", invalidate: QUALITY_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<ActionForm>({
    resolver: zodResolver(actionSchema),
    defaultValues: {
      inspection: record ? String(record.inspection) : forInspection ? String(forInspection.id) : "",
      kind: record?.kind ?? "Corrective",
      description: record?.description ?? "",
      owner: record?.owner ? String(record.owner) : "",
      due_date: record?.due_date ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: { ...values, inspection: Number(values.inspection), owner: values.owner ? Number(values.owner) : null, due_date: orNull(values.due_date) },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit action" : "Add corrective action"}
      description="What will be done about a quality problem, by whom and by when."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="action-inspection" label="Inspection" error={errors.inspection?.message}>
        <Controller control={form.control} name="inspection" render={({ field }) => (
          <SelectField id="action-inspection" value={field.value} onChange={field.onChange} invalid={!!errors.inspection} placeholder="Select inspection"
            options={inspections.filter((i) => !record || i.id === record.inspection)
              .map((i) => ({ value: String(i.id), label: `${i.number} · ${i.material} · ${i.result}` }))} />
        )} />
      </Field>
      <Field id="action-kind" label="Type" hint="Corrective fixes this case; preventive stops it happening again">
        <Controller control={form.control} name="kind" render={({ field }) => (
          <SelectField id="action-kind" value={field.value} onChange={field.onChange} placeholder="Select type"
            options={ACTION_KINDS.map((k) => ({ value: k, label: k }))} />
        )} />
      </Field>
      <Field id="action-description" label="What has to be done" error={errors.description?.message}>
        <Textarea id="action-description" rows={3} aria-invalid={!!errors.description} {...form.register("description")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="action-owner" label="Responsible">
          <Controller control={form.control} name="owner" render={({ field }) => (
            <SelectField id="action-owner" value={field.value} onChange={field.onChange} placeholder="Nobody yet" allowNone="Nobody yet"
              options={users.map((u) => ({ value: String(u.id), label: u.username }))} />
          )} />
        </Field>
        <Field id="action-due" label="Due date" error={errors.due_date?.message}>
          <Input id="action-due" type="date" {...form.register("due_date")} />
        </Field>
      </div>
    </FormDialog>
  )
}

// ─── Standard ───────────────────────────────────────────────────────────────

export function StandardDialog(props: DialogProps<QualityStandard>) {
  return props.open ? <StandardDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function StandardDialogBody({ open, onOpenChange, record }: DialogProps<QualityStandard>) {
  const save = useSave<QualityStandard>("quality/standards", { noun: "Standard", invalidate: QUALITY_LISTS })
  const [formError, setFormError] = useState("")
  const form = useForm<StandardForm>({
    resolver: zodResolver(standardSchema),
    defaultValues: {
      name: record?.name ?? "",
      stage: record?.stage ?? "Incoming",
      material_type: record?.material_type ?? "",
      is_active: record?.is_active === false ? "no" : "yes",
      notes: record?.notes ?? "",
      checks: record?.checks.map((c) => ({ name: c.name, kind: c.kind, unit: c.unit, min_value: c.min_value ?? "", max_value: c.max_value ?? "" }))
        ?? [{ name: "", kind: "Measure", unit: "", min_value: "", max_value: "" }],
    },
  })
  const checks = useFieldArray({ control: form.control, name: "checks" })
  const { errors, isSubmitting } = form.formState
  const watched = useWatch({ control: form.control, name: "checks" })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          is_active: values.is_active === "yes",
          checks: values.checks.map((c) => ({
            ...c,
            unit: c.kind === "Measure" ? c.unit : "",
            min_value: c.kind === "Measure" ? orNull(c.min_value) : null,
            max_value: c.kind === "Measure" ? orNull(c.max_value) : null,
          })),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New quality standard"}
      description="A checklist with limits. Inspections that use it copy the limits, so past inspections don't change when you edit it."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <Field id="standard-name" label="Name" error={errors.name?.message}>
        <Input id="standard-name" placeholder="e.g. Incoming cotton waste" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="standard-stage" label="Stage">
          <Controller control={form.control} name="stage" render={({ field }) => (
            <SelectField id="standard-stage" value={field.value} onChange={field.onChange} placeholder="Select stage"
              options={STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))} />
          )} />
        </Field>
        <Field id="standard-active" label="Status">
          <Controller control={form.control} name="is_active" render={({ field }) => (
            <SelectField id="standard-active" value={field.value} onChange={field.onChange} placeholder="Select status"
              options={[{ value: "yes", label: "In use" }, { value: "no", label: "Not in use" }]} />
          )} />
        </Field>
      </div>
      <Field id="standard-material" label="Material" hint="Leave empty to use it for any material" error={errors.material_type?.message}>
        <Input id="standard-material" placeholder="e.g. Cotton" {...form.register("material_type")} />
      </Field>
      <FieldGroup title="Checks">
        <div className="hidden grid-cols-[1fr_8rem_4rem_4.5rem_4.5rem_auto] gap-2 px-0.5 text-xs text-muted-foreground sm:grid">
          <span>Check</span><span>Type</span><span>Unit</span><span>Min</span><span>Max</span><span className="w-9" />
        </div>
        {checks.fields.map((check, i) => {
          const measure = (watched?.[i]?.kind ?? check.kind) === "Measure"
          return (
            <div key={check.id} className="space-y-1">
              <div className="grid grid-cols-[1fr_8rem_4rem_4.5rem_4.5rem_auto] items-start gap-2">
                <Input aria-label={`Check ${i + 1}`} placeholder="e.g. Moisture" aria-invalid={!!errors.checks?.[i]?.name}
                  {...form.register(`checks.${i}.name`)} />
                <Controller control={form.control} name={`checks.${i}.kind`} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-label={`Type ${i + 1}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHECK_KINDS.map((k) => <SelectItem key={k} value={k}>{k === "Measure" ? "Measured" : "Yes / no"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
                <Input aria-label={`Unit ${i + 1}`} placeholder="%" disabled={!measure} {...form.register(`checks.${i}.unit`)} />
                <Input aria-label={`Minimum ${i + 1}`} inputMode="decimal" disabled={!measure} aria-invalid={!!errors.checks?.[i]?.min_value}
                  {...form.register(`checks.${i}.min_value`)} />
                <Input aria-label={`Maximum ${i + 1}`} inputMode="decimal" disabled={!measure} aria-invalid={!!errors.checks?.[i]?.max_value}
                  {...form.register(`checks.${i}.max_value`)} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove check ${i + 1}`}
                  disabled={checks.fields.length === 1} onClick={() => checks.remove(i)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {rowError(errors, "checks", i) && <p className="text-[13px] text-destructive">{rowError(errors, "checks", i)}</p>}
            </div>
          )
        })}
        <Button type="button" variant="outline" className="w-fit"
          onClick={() => checks.append({ name: "", kind: "Measure", unit: "", min_value: "", max_value: "" })}>
          <Plus className="size-4" /> Add check
        </Button>
        {errors.checks?.root?.message && <p className="text-[13px] text-destructive">{errors.checks.root.message}</p>}
      </FieldGroup>
      <Field id="standard-notes" label="Notes">
        <Textarea id="standard-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}
