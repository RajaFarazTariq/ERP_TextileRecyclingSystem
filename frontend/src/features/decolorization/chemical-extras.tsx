"use client"

// Chemical lots, recipes, planned-against-actual consumption and the usage report.
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Beaker, Coins, Droplets, Plus, Scale, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Controller, useFieldArray, useForm } from "react-hook-form"

import { DataTable, type TableColumn } from "@/components/common/data-table"
import { DateFilter, type DateFilterValue, dateParams } from "@/components/common/date-filter"
import { Field, FieldGroup, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { StatCard } from "@/components/common/stat-card"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { today } from "@/features/procurement/schemas"
import { api } from "@/lib/api"
import { useSave } from "@/lib/crud"
import { date, kg, plural, rupees } from "@/lib/format"
import { applyServerErrors } from "@/lib/forms"
import { cn } from "@/lib/utils"
import type {
  Chemical, ChemicalLot, ChemicalUsage, Consumption, DecolorizationSession, Recipe, RecipeVersion, SupplierOption,
} from "@/types/api"
import { supplierOptions } from "./decolorization-forms"
import { type LotForm, type RecipeForm, lotSchema, recipeSchema } from "./schemas"

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

const n = (v: string | number | null | undefined) => Number(v) || 0
const amount = (v: string | number | null | undefined) => n(v).toLocaleString("en-PK", { maximumFractionDigits: 2 })
const orNull = (v: string) => (v ? v : null)

/** "80 °C · 90 min · 300 L water per 100 kg" for a recipe version. */
export function processText(v: Pick<RecipeVersion, "temperature_c" | "duration_minutes" | "water_liters_per_100kg">): string {
  return [
    v.temperature_c != null ? `${n(v.temperature_c)} °C` : "",
    v.duration_minutes != null ? `${v.duration_minutes} min` : "",
    v.water_liters_per_100kg != null ? `${amount(v.water_liters_per_100kg)} L water per 100 kg` : "",
  ].filter(Boolean).join(" · ")
}

// ─── Chemical lot ───────────────────────────────────────────────────────────

type LotDialogProps = DialogProps<ChemicalLot> & { chemicals: Chemical[]; suppliers: SupplierOption[] }

export function LotDialog(props: LotDialogProps) {
  return props.open ? <LotDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function LotDialogBody({ open, onOpenChange, record, chemicals, suppliers }: LotDialogProps) {
  const save = useSave<ChemicalLot>("decolorization/lots", { noun: "Chemical lot", invalidate: [["decolorization/chemicals"]] })
  const [formError, setFormError] = useState("")
  const form = useForm<LotForm>({
    resolver: zodResolver(lotSchema),
    defaultValues: {
      chemical: record ? String(record.chemical) : "",
      lot_number: record?.lot_number ?? "",
      received_on: record?.received_on ?? today(),
      quantity: record?.quantity ?? "",
      unit_cost: record && n(record.unit_cost) ? record.unit_cost : "",
      supplier: record?.supplier ? String(record.supplier) : "",
      expiry_date: record?.expiry_date ?? "",
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
          ...values,
          chemical: Number(values.chemical),
          unit_cost: values.unit_cost || "0",
          supplier: values.supplier ? Number(values.supplier) : null,
          expiry_date: orNull(values.expiry_date),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit lot ${record.lot_number}` : "Receive chemical lot"}
      description={record
        ? "The chemical and quantity are fixed once a lot is received. To correct them, delete the lot and enter it again."
        : "The quantity is added to the chemical's stock, and the cost becomes the chemical's current cost."}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Receive"} onSubmit={onSubmit}>
      <Field id="lot-chemical" label="Chemical" error={errors.chemical?.message}>
        <Controller control={form.control} name="chemical" render={({ field }) => (
          <SelectField id="lot-chemical" value={field.value} onChange={field.onChange} invalid={!!errors.chemical} disabled={!!record}
            placeholder="Select chemical" options={chemicals.map((c) => ({ value: String(c.id), label: `${c.chemical_name} (${c.unit_of_measure})` }))} />
        )} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="lot_number" label="Lot number" error={errors.lot_number?.message}>
          <Input id="lot_number" placeholder="As printed on the drum" aria-invalid={!!errors.lot_number} {...form.register("lot_number")} />
        </Field>
        <Field id="lot-quantity" label="Quantity" error={errors.quantity?.message}>
          <Input id="lot-quantity" inputMode="decimal" disabled={!!record} aria-invalid={!!errors.quantity} {...form.register("quantity")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="lot-cost" label="Cost per unit (Rs.)" error={errors.unit_cost?.message}>
          <Input id="lot-cost" inputMode="decimal" aria-invalid={!!errors.unit_cost} {...form.register("unit_cost")} />
        </Field>
        <Field id="lot-supplier" label="Supplier">
          <Controller control={form.control} name="supplier" render={({ field }) => (
            <SelectField id="lot-supplier" value={field.value} onChange={field.onChange} placeholder="None" allowNone="None"
              options={supplierOptions(suppliers, record?.supplier)} />
          )} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="received_on" label="Received on" error={errors.received_on?.message}>
          <Input id="received_on" type="date" aria-invalid={!!errors.received_on} {...form.register("received_on")} />
        </Field>
        <Field id="expiry_date" label="Expiry date" hint="Optional" error={errors.expiry_date?.message}>
          <Input id="expiry_date" type="date" aria-invalid={!!errors.expiry_date} {...form.register("expiry_date")} />
        </Field>
      </div>
      <Field id="lot-notes" label="Notes">
        <Textarea id="lot-notes" rows={2} {...form.register("notes")} />
      </Field>
    </FormDialog>
  )
}

// ─── Recipe ─────────────────────────────────────────────────────────────────

type RecipeDialogProps = DialogProps<Recipe> & { chemicals: Chemical[] }

export function RecipeDialog(props: RecipeDialogProps) {
  return props.open ? <RecipeDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function RecipeDialogBody({ open, onOpenChange, record, chemicals }: RecipeDialogProps) {
  const save = useSave<Recipe>("decolorization/recipes", { noun: "Recipe" })
  const [formError, setFormError] = useState("")
  const current = record?.versions[0]
  const form = useForm<RecipeForm>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      name: record?.name ?? "",
      material_type: record?.material_type ?? "",
      is_active: record && !record.is_active ? "no" : "yes",
      temperature_c: current?.temperature_c ?? "",
      duration_minutes: current?.duration_minutes != null ? String(current.duration_minutes) : "",
      water_liters_per_100kg: current?.water_liters_per_100kg ?? "",
      change_note: "",
      lines: current?.lines.map((l) => ({ chemical: String(l.chemical), quantity_per_100kg: l.quantity_per_100kg }))
        ?? [{ chemical: "", quantity_per_100kg: "" }],
    },
  })
  const lines = useFieldArray({ control: form.control, name: "lines" })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          ...values,
          is_active: values.is_active === "yes",
          temperature_c: orNull(values.temperature_c),
          duration_minutes: values.duration_minutes ? Number(values.duration_minutes) : null,
          water_liters_per_100kg: orNull(values.water_liters_per_100kg),
          lines: values.lines.map((l) => ({ chemical: Number(l.chemical), quantity_per_100kg: l.quantity_per_100kg })),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New recipe"}
      description={record
        ? `Now at version ${current?.version}. Changing the chemicals or the process saves version ${(current?.version ?? 0) + 1}; batches already run keep the version they used.`
        : "The chemicals and settings for decolorizing 100 kg of material."}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit} className="sm:max-w-xl">
      <Field id="recipe-name" label="Name" error={errors.name?.message}>
        <Input id="recipe-name" placeholder="e.g. Cotton bleach" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="recipe-material" label="Material" hint="Leave empty to use it for any material" error={errors.material_type?.message}>
          <Input id="recipe-material" placeholder="e.g. Cotton" {...form.register("material_type")} />
        </Field>
        <Field id="recipe-active" label="Status">
          <Controller control={form.control} name="is_active" render={({ field }) => (
            <SelectField id="recipe-active" value={field.value} onChange={field.onChange} placeholder="Select status"
              options={[{ value: "yes", label: "In use" }, { value: "no", label: "Not in use" }]} />
          )} />
        </Field>
      </div>
      <FieldGroup title="Chemicals per 100 kg">
        {lines.fields.map((line, i) => (
          <div key={line.id} className="space-y-1">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
              <Controller control={form.control} name={`lines.${i}.chemical`} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="col-span-full w-full sm:col-span-1" aria-label={`Chemical ${i + 1}`} aria-invalid={!!errors.lines?.[i]?.chemical}>
                    <SelectValue placeholder="Select chemical" />
                  </SelectTrigger>
                  <SelectContent>
                    {chemicals.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.chemical_name} ({c.unit_of_measure})</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
              <Input aria-label={`Quantity ${i + 1}`} placeholder="Quantity" inputMode="decimal" aria-invalid={!!errors.lines?.[i]?.quantity_per_100kg}
                {...form.register(`lines.${i}.quantity_per_100kg`)} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove chemical ${i + 1}`}
                disabled={lines.fields.length === 1} onClick={() => lines.remove(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            {(errors.lines?.[i]?.chemical ?? errors.lines?.[i]?.quantity_per_100kg) && (
              <p className="text-[13px] text-destructive">{(errors.lines[i]?.chemical ?? errors.lines[i]?.quantity_per_100kg)?.message}</p>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" className="w-fit" onClick={() => lines.append({ chemical: "", quantity_per_100kg: "" })}>
          <Plus className="size-4" /> Add chemical
        </Button>
        {errors.lines?.root?.message && <p className="text-[13px] text-destructive">{errors.lines.root.message}</p>}
      </FieldGroup>
      <FieldGroup title="Process">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="recipe-temperature" label="Temperature, °C" error={errors.temperature_c?.message}>
            <Input id="recipe-temperature" inputMode="decimal" aria-invalid={!!errors.temperature_c} {...form.register("temperature_c")} />
          </Field>
          <Field id="recipe-duration" label="Duration, minutes" error={errors.duration_minutes?.message}>
            <Input id="recipe-duration" inputMode="numeric" aria-invalid={!!errors.duration_minutes} {...form.register("duration_minutes")} />
          </Field>
          <Field id="recipe-water" label="Water, L per 100 kg" error={errors.water_liters_per_100kg?.message}>
            <Input id="recipe-water" inputMode="decimal" aria-invalid={!!errors.water_liters_per_100kg} {...form.register("water_liters_per_100kg")} />
          </Field>
        </div>
      </FieldGroup>
      {record && (
        <>
          <Field id="recipe-change" label="What changed" hint="Kept with the new version, if this edit makes one">
            <Input id="recipe-change" placeholder="e.g. Less peroxide after the September trials" {...form.register("change_note")} />
          </Field>
          <FieldGroup title="Version history">
            <ul className="grid gap-2 text-sm">
              {record.versions.map((v) => (
                <li key={v.id} className="rounded-lg border px-3 py-2">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium">Version {v.version}</span>
                    <span className="text-xs text-muted-foreground">{date(v.created_at)} · {v.created_by_name} · {plural(v.sessions, "batch", "batches")}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {v.lines.map((l) => `${l.chemical_name} ${amount(l.quantity_per_100kg)} ${l.unit_of_measure}`).join(", ")}
                  </p>
                  {processText(v) && <p className="text-muted-foreground">{processText(v)}</p>}
                  {v.notes && <p className="mt-1">{v.notes}</p>}
                </li>
              ))}
            </ul>
          </FieldGroup>
        </>
      )}
    </FormDialog>
  )
}

// ─── Planned against actual for one batch ───────────────────────────────────

export function ConsumptionSheet({ session, onOpenChange }: { session: DecolorizationSession | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={!!session} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 bg-elevated p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {session && <ConsumptionBody key={session.id} session={session} />}
      </SheetContent>
    </Sheet>
  )
}

function Compare({ label, planned, actual, unit }: { label: string; planned: string | number | null; actual: string | number | null; unit: string }) {
  if (planned == null && actual == null) return null
  const show = (v: string | number) => (unit === "Rs." ? `Rs. ${amount(v)}` : `${amount(v)} ${unit}`)
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{actual != null ? show(actual) : "Not recorded"}</p>
      {planned != null && <p className="text-xs text-muted-foreground tabular-nums">Recipe: {show(planned)}</p>}
    </div>
  )
}

function ConsumptionBody({ session }: { session: DecolorizationSession }) {
  const query = useQuery<Consumption>({
    queryKey: ["decolorization/sessions", session.id, "consumption"],
    queryFn: () => api(`decolorization/sessions/${session.id}/consumption`),
  })
  const data = query.data

  return (
    <>
      <SheetHeader className="border-b px-6 pt-5 pb-4">
        <SheetTitle className="font-heading text-lg font-semibold tracking-tight">Chemicals used: session #{session.id}</SheetTitle>
        <SheetDescription>
          {session.tank_name} · {session.fabric_material} · {kg(session.input_quantity)} in
          {session.approved_at ? ` · Approved by ${session.approved_by_name} on ${date(session.approved_at)}` : " · Not approved yet"}
        </SheetDescription>
      </SheetHeader>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {query.isError ? <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
          : !data ? <TableSkeleton columns={4} />
          : (
            <>
              <p className="text-sm text-muted-foreground">
                {data.recipe
                  ? <>Recipe <span className="font-medium text-foreground">{data.recipe}</span>, scaled to {kg(data.input_quantity)}.</>
                  : "No recipe was chosen for this batch, so there is no plan to compare against."}
              </p>
              {data.lines.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                        <th>Chemical</th><th className="text-right">Planned</th><th className="text-right">Issued</th>
                        <th className="text-right">Difference</th><th className="text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {data.lines.map((l) => {
                        const diff = n(l.variance)
                        return (
                          <tr key={l.chemical} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2">
                            <td className="font-medium">{l.chemical_name} <span className="font-normal text-muted-foreground">({l.unit})</span></td>
                            <td className="text-right">{data.recipe ? amount(l.planned) : "—"}</td>
                            <td className="text-right">{amount(l.actual)}</td>
                            <td className={cn("text-right", !data.recipe || diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-warning-fg" : "text-success-fg")}>
                              {!data.recipe ? "—" : diff === 0 ? "On plan" : `${diff > 0 ? "+" : "−"}${amount(Math.abs(diff))}`}
                            </td>
                            <td className="text-right">{rupees(l.actual_cost)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">No chemicals have been issued to this batch yet.</p>}
              <div className="grid gap-3 sm:grid-cols-3">
                <Compare label="Chemical cost" planned={data.recipe ? data.planned_cost : null} actual={data.actual_cost} unit="Rs." />
                <Compare label="Cost per kg treated" planned={null} actual={data.cost_per_kg} unit="Rs." />
                <Compare label="Temperature" planned={data.process.planned_temperature_c} actual={data.process.temperature_c} unit="°C" />
                <Compare label="Duration" planned={data.process.planned_duration_minutes} actual={data.process.duration_minutes} unit="min" />
                <Compare label="Water" planned={data.process.planned_water_liters} actual={data.process.water_liters} unit="L" />
              </div>
            </>
          )}
      </div>
    </>
  )
}

// ─── Usage report ───────────────────────────────────────────────────────────

type UsageRow = ChemicalUsage["chemicals"][number]

export function UsagePanel() {
  const [period, setPeriod] = useState<DateFilterValue>({ type: "this_month" })
  const params = dateParams(period)
  const usage = useQuery<ChemicalUsage>({
    queryKey: ["decolorization/usage", params], queryFn: () => api("decolorization/usage", { params }),
  })

  const columns = useMemo<TableColumn<UsageRow>[]>(() => [
    { accessorKey: "chemical_name", header: "Chemical", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { id: "quantity", header: "Issued", accessorFn: (r) => n(r.quantity), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{amount(row.original.quantity)} {row.original.unit}</span> },
    { accessorKey: "issuances", header: "Issuances", sortFn: "basic", cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
    { id: "cost", header: "Cost", accessorFn: (r) => n(r.cost), sortFn: "basic",
      cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.cost)}</span> },
  ], [])

  const data = usage.data
  const treated = n(data?.treated_kg)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DateFilter value={period} onChange={setPeriod} />
        <span className="text-sm text-muted-foreground">By the date the chemical was issued</span>
      </div>
      {usage.isError ? <ErrorState message={usage.error.message} onRetry={() => usage.refetch()} />
        : !data ? <TableSkeleton columns={4} />
        : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Chemical cost" icon={Coins} tone="decolorization" value={rupees(data.total_cost)} muted={!n(data.total_cost)}
                hint={plural(data.issuances, "issuance")} />
              <StatCard label="Chemicals used" icon={Beaker} tone="info" value={data.chemicals.length} muted={!data.chemicals.length} />
              <StatCard label="Batches treated" icon={Droplets} tone="info" value={data.batches} muted={!data.batches}
                hint={treated ? kg(treated) : "No issuance is linked to a batch"} />
              <StatCard label="Cost per kg treated" icon={Scale} tone="warning" muted={data.cost_per_kg == null}
                value={data.cost_per_kg != null ? `Rs. ${amount(data.cost_per_kg)}` : "—"}
                hint={data.cost_per_kg != null ? `${rupees(data.batch_cost)} issued to those batches` : "Needs issuances tied to a batch"} />
            </div>
            <DataTable columns={columns} data={data.chemicals} searchPlaceholder="Search chemicals…" emptyTitle="No chemicals were issued in this period"
              initialSorting={[{ id: "cost", desc: true }]} exportName="chemical-usage" />
          </>
        )}
    </div>
  )
}
