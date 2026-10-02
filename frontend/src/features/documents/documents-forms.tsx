"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, FileText } from "lucide-react"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Field, FieldGroup, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ROLE_LABELS } from "@/config/access"
import { ApiError, api } from "@/lib/api"
import { useSave } from "@/lib/crud"
import { downloadFile } from "@/lib/download"
import { date, displayName } from "@/lib/format"
import { applyServerErrors } from "@/lib/forms"
import type { DocumentCategory, DocumentRecord, DocumentVersion } from "@/types/documents"
import {
  CATEGORY_ROLES, type CategoryForm, type DocumentForm, LINK_TYPES, type UploadRules,
  categorySchema, documentSchema, fileProblem, fileSize, upload,
} from "./schemas"

// Everything that shows documents: an upload or an edit changes all of them
export const DOCUMENT_LISTS = [
  ["documents/documents"], ["documents/expiring"], ["documents/summary"], ["documents/categories"],
]

interface DialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: T | null
}

/** Save one stored file to the user's computer; `version` picks an earlier one. */
export async function downloadDocument(document: Pick<DocumentRecord, "id" | "file_name">, version?: number) {
  const path = version ? `documents/documents/${document.id}/versions/${version}/download` : `documents/documents/${document.id}/download`
  try {
    toast.success(`Downloaded ${await downloadFile(path, undefined, document.file_name || "document")}`)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Download failed.")
  }
}

function useRefresh() {
  const qc = useQueryClient()
  return () => DOCUMENT_LISTS.forEach((queryKey) => qc.invalidateQueries({ queryKey }))
}

/** File picker that says what may be uploaded. */
function FileField({ id, rules, error, onChange }: { id: string; rules: UploadRules; error?: string; onChange: (file: File | null) => void }) {
  return (
    <Field id={id} label="File" error={error} hint={`Allowed: ${rules.extensions.join(", ")}. Up to ${rules.maxMb} MB.`}>
      <Input id={id} type="file" aria-invalid={!!error} accept={rules.extensions.map((e) => `.${e}`).join(",")}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </Field>
  )
}

// ─── Document: upload, or edit the details ──────────────────────────────────

type DocumentDialogProps = DialogProps<DocumentRecord> & { categories: DocumentCategory[]; admin: boolean; rules: UploadRules }

export function DocumentDialog(props: DocumentDialogProps) {
  return props.open ? <DocumentDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function DocumentDialogBody({ open, onOpenChange, record, categories, admin, rules }: DocumentDialogProps) {
  const save = useSave<DocumentRecord>("documents/documents", { noun: "Document", invalidate: DOCUMENT_LISTS })
  const refresh = useRefresh()
  const [formError, setFormError] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState("")
  const form = useForm<DocumentForm>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      title: record?.title ?? "",
      category: record ? String(record.category) : "",
      reference_number: record?.reference_number ?? "",
      issued_on: record?.issued_on ?? "",
      expires_on: record?.expires_on ?? "",
      linked_type: record?.linked_type ?? "",
      linked_label: record?.linked_label ?? "",
      description: record?.description ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const linkedType = useWatch({ control: form.control, name: "linked_type" })
  const options = categories.filter((c) => c.is_active || c.id === record?.category)

  const submit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      if (record) {
        await save.mutateAsync({
          id: record.id,
          body: {
            ...values,
            category: Number(values.category),
            issued_on: values.issued_on || null,
            expires_on: values.expires_on || null,
            linked_label: values.linked_type ? values.linked_label : "",
          },
        })
      } else {
        const body = new FormData()
        body.set("file", file!)
        body.set("title", values.title)
        body.set("category", values.category)
        body.set("reference_number", values.reference_number)
        body.set("description", values.description)
        if (values.issued_on) body.set("issued_on", values.issued_on)
        if (values.expires_on) body.set("expires_on", values.expires_on)
        if (values.linked_type) {
          body.set("linked_type", values.linked_type)
          body.set("linked_label", values.linked_label)
        }
        await upload<DocumentRecord>("documents/documents", body)
        toast.success("Document added.")
        refresh()
      }
      onOpenChange(false)
    } catch (error) {
      // The server's reason for refusing the file belongs under the file field
      const refused = error instanceof ApiError ? error.fieldErrors.file : undefined
      if (refused) setFileError(refused)
      const rest = applyServerErrors(error, form.setError, [...Object.keys(values), "file"])
      setFormError(rest)
    }
  })

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const problem = record ? "" : fileProblem(file, rules)
    setFileError(problem)
    if (problem) {
      e.preventDefault()
      void form.trigger()
      return
    }
    void submit(e)
  }

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.number}` : "Upload document"}
      description={record
        ? "Change the details. To replace the file, use “New version”."
        : "The category decides who can see the document."}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Upload"} onSubmit={onSubmit} className="sm:max-w-xl">
      {!record && <FileField id="doc-file" rules={rules} error={fileError} onChange={(f) => { setFile(f); setFileError("") }} />}
      <Field id="doc-title" label="Title" error={errors.title?.message}>
        <Input id="doc-title" placeholder="e.g. ISO 9001 certificate" aria-invalid={!!errors.title} {...form.register("title")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="doc-category" label="Category" error={errors.category?.message}
          hint={record && !admin ? "Only an admin can move a document" : undefined}>
          <Controller control={form.control} name="category" render={({ field }) => (
            <SelectField id="doc-category" value={field.value} onChange={field.onChange} invalid={!!errors.category}
              disabled={!!record && !admin} placeholder="Select category"
              options={options.map((c) => ({ value: String(c.id), label: c.name }))} />
          )} />
        </Field>
        <Field id="doc-reference" label="Reference number" hint="The number printed on the document" error={errors.reference_number?.message}>
          <Input id="doc-reference" {...form.register("reference_number")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="doc-issued" label="Issued on" error={errors.issued_on?.message}>
          <Input id="doc-issued" type="date" {...form.register("issued_on")} />
        </Field>
        <Field id="doc-expires" label="Expires on" hint="Leave empty if it never expires" error={errors.expires_on?.message}>
          <Input id="doc-expires" type="date" aria-invalid={!!errors.expires_on} {...form.register("expires_on")} />
        </Field>
      </div>
      <FieldGroup title="Belongs to">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="doc-linked-type" label="Linked to">
            <Controller control={form.control} name="linked_type" render={({ field }) => (
              <SelectField id="doc-linked-type" value={field.value} onChange={field.onChange} placeholder="Nothing" allowNone="Nothing"
                options={LINK_TYPES.map((t) => ({ value: t, label: t }))} />
            )} />
          </Field>
          <Field id="doc-linked-label" label="Record" hint="Its name or number" error={errors.linked_label?.message}>
            <Input id="doc-linked-label" disabled={!linkedType} placeholder={linkedType ? "e.g. PO-00012" : ""}
              aria-invalid={!!errors.linked_label} {...form.register("linked_label")} />
          </Field>
        </div>
      </FieldGroup>
      <Field id="doc-description" label="Description">
        <Textarea id="doc-description" rows={2} {...form.register("description")} />
      </Field>
    </FormDialog>
  )
}

// ─── New version ────────────────────────────────────────────────────────────

type VersionDialogProps = { document: DocumentRecord | null; onOpenChange: (o: boolean) => void; rules: UploadRules }

export function VersionDialog(props: VersionDialogProps) {
  return props.document ? <VersionDialogBody key={props.document.id} {...props} document={props.document} /> : null
}

function VersionDialogBody({ document, onOpenChange, rules }: VersionDialogProps & { document: DocumentRecord }) {
  const refresh = useRefresh()
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  return (
    <FormDialog open onOpenChange={onOpenChange} title={`New version of ${document.number}`}
      description={`${document.title} is at version ${document.current_version}. Earlier versions stay available.`}
      submitting={busy} submitLabel="Upload"
      onSubmit={async (e) => {
        e.preventDefault()
        const problem = fileProblem(file, rules)
        setError(problem)
        if (problem) return
        setBusy(true)
        try {
          const body = new FormData()
          body.set("file", file!)
          body.set("note", note.trim())
          const version = await upload<DocumentVersion>(`documents/documents/${document.id}/versions`, body)
          toast.success(`Version ${version.version} added.`)
          refresh()
          onOpenChange(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not upload the file.")
        } finally {
          setBusy(false)
        }
      }}>
      <FileField id="version-file" rules={rules} error={error} onChange={(f) => { setFile(f); setError("") }} />
      <Field id="version-note" label="What changed" hint="e.g. renewed for another year">
        <Input id="version-note" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormDialog>
  )
}

// ─── Versions ───────────────────────────────────────────────────────────────

export function VersionsSheet({ document, onOpenChange }: { document: DocumentRecord | null; onOpenChange: (o: boolean) => void }) {
  const d = document
  const versions = useQuery<DocumentVersion[]>({
    queryKey: ["documents/documents", d?.id, "versions"],
    queryFn: () => api(`documents/documents/${d!.id}/versions`),
    enabled: !!d,
  })
  return (
    <Sheet open={!!d} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 bg-elevated p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {d && (
          <>
            <SheetHeader className="border-b px-6 pt-5 pb-4">
              <SheetTitle className="font-heading text-lg font-semibold tracking-tight">Versions of {d.number}</SheetTitle>
              <SheetDescription>{d.title} · {d.category_name}</SheetDescription>
            </SheetHeader>
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {versions.isError ? <ErrorState message={versions.error.message} onRetry={() => versions.refetch()} />
                : versions.isPending ? <Skeleton className="h-24 w-full rounded-xl" /> : (
                  <ul className="space-y-2">
                    {versions.data.map((v) => (
                      <li key={v.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="font-medium">
                            Version {v.version}
                            {v.version === d.current_version && <span className="ml-2 text-xs font-normal text-success-fg">Current</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground" title={v.original_name}>{v.original_name} · {fileSize(v.size_bytes)}</p>
                          <p className="truncate text-xs text-muted-foreground">{date(v.uploaded_at)} by {displayName(v.uploaded_by_name)}</p>
                          {v.note && <p className="mt-1 text-xs break-words">{v.note}</p>}
                        </div>
                        <Button variant="outline" size="sm" aria-label={`Download version ${v.version}`}
                          onClick={() => downloadDocument({ id: d.id, file_name: v.original_name }, v.version)}>
                          <Download className="size-3.5" /> Download
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Category ───────────────────────────────────────────────────────────────

const YES_NO = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]

export function CategoryDialog(props: DialogProps<DocumentCategory>) {
  return props.open ? <CategoryDialogBody key={props.record?.id ?? "new"} {...props} /> : null
}

function CategoryDialogBody({ open, onOpenChange, record }: DialogProps<DocumentCategory>) {
  const save = useSave<DocumentCategory>("documents/categories", { noun: "Category", invalidate: DOCUMENT_LISTS })
  const [formError, setFormError] = useState("")
  const may = (role: (typeof CATEGORY_ROLES)[number]) => (record?.allowed_roles.includes(role) ? "yes" as const : "no" as const)
  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: record?.name ?? "",
      description: record?.description ?? "",
      is_active: record?.is_active === false ? "no" : "yes",
      warehouse_supervisor: may("warehouse_supervisor"),
      sorting_supervisor: may("sorting_supervisor"),
      decolorization_supervisor: may("decolorization_supervisor"),
      drying_supervisor: may("drying_supervisor"),
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      await save.mutateAsync({
        id: record?.id,
        body: {
          name: values.name,
          description: values.description,
          is_active: values.is_active === "yes",
          allowed_roles: CATEGORY_ROLES.filter((role) => values[role] === "yes"),
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "New category"}
      description="A category groups documents and decides which roles can see them. Admins always see everything."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Save"} onSubmit={onSubmit}>
      <Field id="category-name" label="Name" error={errors.name?.message}>
        <Input id="category-name" placeholder="e.g. Permits" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <Field id="category-description" label="Description" error={errors.description?.message}>
        <Input id="category-description" {...form.register("description")} />
      </Field>
      <FieldGroup title="Who can see it">
        <div className="grid gap-4 sm:grid-cols-2">
          {CATEGORY_ROLES.map((role) => (
            <Field key={role} id={`category-${role}`} label={ROLE_LABELS[role]}>
              <Controller control={form.control} name={role} render={({ field }) => (
                <SelectField id={`category-${role}`} value={field.value} onChange={field.onChange} placeholder="Select" options={YES_NO} />
              )} />
            </Field>
          ))}
        </div>
      </FieldGroup>
      <Field id="category-active" label="Status" hint="A category that is not in use keeps its documents but takes no new ones">
        <Controller control={form.control} name="is_active" render={({ field }) => (
          <SelectField id="category-active" value={field.value} onChange={field.onChange} placeholder="Select status"
            options={[{ value: "yes", label: "In use" }, { value: "no", label: "Not in use" }]} />
        )} />
      </Field>
    </FormDialog>
  )
}
