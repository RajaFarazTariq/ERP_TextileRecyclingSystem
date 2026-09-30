"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"

import { Field, FormDialog } from "@/components/common/form-dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useSave } from "@/lib/crud"
import { applyServerErrors } from "@/lib/forms"
import type { FactoryUnit, StockEntry, Vendor } from "@/types/api"
import {
  STOCK_STATUSES,
  type StockForm,
  type UnitForm,
  type VendorForm,
  stockSchema,
  unitSchema,
  vendorSchema,
} from "./schemas"

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

// ─── Stock entry ────────────────────────────────────────────────────────────

const emptyStock: StockForm = {
  vendor: "", unit: "", fabric_type: "", vendor_weight_slip: "", vehicle_no: "",
  our_weight: "", unloading_weight: "", status: "Received",
}

type StockDialogProps = DialogProps<StockEntry> & { vendors: Vendor[]; units: FactoryUnit[] }

export function StockDialog(props: StockDialogProps) {
  return props.open ? <StockDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function StockDialogBody({ open, onOpenChange, record, vendors, units }: StockDialogProps) {
  const save = useSave<StockEntry>("warehouse/stock", { noun: "Stock entry" })
  const [formError, setFormError] = useState("")
  const form = useForm<StockForm>({
    resolver: zodResolver(stockSchema),
    defaultValues: record
      ? {
          vendor: String(record.vendor), unit: String(record.unit), fabric_type: record.fabric_type,
          vendor_weight_slip: record.vendor_weight_slip, vehicle_no: record.vehicle_no,
          our_weight: record.our_weight, unloading_weight: record.unloading_weight, status: record.status,
        }
      : emptyStock,
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: { ...values, vendor: Number(values.vendor), unit: Number(values.unit) },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(emptyStock)))
    }
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Edit stock entry" : "Add stock entry"}
      description="A delivery of fabric received at a factory unit."
      error={formError}
      submitting={isSubmitting}
      submitLabel={record ? "Update" : "Save"}
      onSubmit={onSubmit}
    >
      <Field id="vendor" label="Vendor" error={errors.vendor?.message}>
        <Controller
          control={form.control}
          name="vendor"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="vendor" className="w-full" aria-invalid={!!errors.vendor}>
                <SelectValue placeholder={vendors.length ? "Select vendor" : "Add a vendor first"} />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field id="fabric_type" label="Fabric type" error={errors.fabric_type?.message}>
        <Input id="fabric_type" placeholder="e.g. Cotton White" aria-invalid={!!errors.fabric_type} {...form.register("fabric_type")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="vendor_weight_slip" label="Vendor weight slip" error={errors.vendor_weight_slip?.message}>
          <Input id="vendor_weight_slip" aria-invalid={!!errors.vendor_weight_slip} {...form.register("vendor_weight_slip")} />
        </Field>
        <Field id="vehicle_no" label="Vehicle no." error={errors.vehicle_no?.message}>
          <Input id="vehicle_no" aria-invalid={!!errors.vehicle_no} {...form.register("vehicle_no")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="our_weight" label="Our weight (kg)" error={errors.our_weight?.message}>
          <Input id="our_weight" inputMode="decimal" aria-invalid={!!errors.our_weight} {...form.register("our_weight")} />
        </Field>
        <Field id="unloading_weight" label="Unloading weight (kg)" error={errors.unloading_weight?.message}>
          <Input id="unloading_weight" inputMode="decimal" aria-invalid={!!errors.unloading_weight} {...form.register("unloading_weight")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="unit" label="Factory unit" error={errors.unit?.message}>
          <Controller
            control={form.control}
            name="unit"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="unit" className="w-full" aria-invalid={!!errors.unit}>
                  <SelectValue placeholder={units.length ? "Select unit" : "Add a unit first"} />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="status" label="Status" error={errors.status?.message}>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STOCK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>
    </FormDialog>
  )
}

// ─── Vendor ─────────────────────────────────────────────────────────────────

export function VendorDialog(props: DialogProps<Vendor>) {
  return props.open ? <VendorDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function VendorDialogBody({ open, onOpenChange, record }: DialogProps<Vendor>) {
  const save = useSave<Vendor>("warehouse/vendors", { noun: "Vendor", invalidate: [["warehouse/stock"]] })
  const [formError, setFormError] = useState("")
  const form = useForm<VendorForm>({
    resolver: zodResolver(vendorSchema),
    defaultValues: { name: record?.name ?? "", contact: record?.contact ?? "", address: record?.address ?? "" },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: values })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["name", "contact", "address"]))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit vendor" : "Add vendor"}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="name" label="Vendor name" error={errors.name?.message}>
        <Input id="name" placeholder="e.g. Ali Traders" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <Field id="contact" label="Contact" error={errors.contact?.message}>
        <Input id="contact" {...form.register("contact")} />
      </Field>
      <Field id="address" label="Address" error={errors.address?.message}>
        <Textarea id="address" rows={2} {...form.register("address")} />
      </Field>
    </FormDialog>
  )
}

// ─── Factory unit ───────────────────────────────────────────────────────────

export function UnitDialog(props: DialogProps<FactoryUnit>) {
  return props.open ? <UnitDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function UnitDialogBody({ open, onOpenChange, record }: DialogProps<FactoryUnit>) {
  const save = useSave<FactoryUnit>("warehouse/units", { noun: "Factory unit", invalidate: [["warehouse/stock"]] })
  const [formError, setFormError] = useState("")
  const form = useForm<UnitForm>({ resolver: zodResolver(unitSchema), defaultValues: { name: record?.name ?? "" } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({ id: record?.id, body: values })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["name"]))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? "Edit factory unit" : "Add factory unit"}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="unit-name" label="Unit name" error={errors.name?.message}>
        <Input id="unit-name" placeholder="e.g. Unit 1" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
    </FormDialog>
  )
}
