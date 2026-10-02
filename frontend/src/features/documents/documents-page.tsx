"use client"

import { useQuery } from "@tanstack/react-query"
import { CalendarClock, CalendarX, CheckCircle2, Download, FilePlus2, Files, History, Pencil, Plus, Upload } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { NameWithAvatar } from "@/components/common/identity"
import { ProgressBar } from "@/components/common/meters"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ROLE_LABELS } from "@/config/access"
import { useSession } from "@/features/auth/use-session"
import { api } from "@/lib/api"
import { useDelete, useList } from "@/lib/crud"
import { date, plural } from "@/lib/format"
import type { DocumentCategory, DocumentRecord, DocumentSummary } from "@/types/documents"
import {
  CategoryDialog, DOCUMENT_LISTS, DocumentDialog, VersionDialog, VersionsSheet, downloadDocument,
} from "./documents-forms"
import { DEFAULT_RULES, STATUSES, STATUS_TONES, daysText, fileSize } from "./schemas"

type Tab = "dashboard" | "documents" | "expiring" | "categories"
type Editing =
  | { kind: "document"; record: DocumentRecord | null }
  | { kind: "category"; record: DocumentCategory | null }
type Deleting = { kind: "document" | "category"; id: number; label: string }

const ALL = "all"

function ExpiryCell({ document }: { document: DocumentRecord }) {
  if (!document.expires_on) return <span className="text-muted-foreground">—</span>
  return (
    <span>
      {date(document.expires_on)}
      {document.status !== "Valid" && (
        <span className={`block text-xs ${document.status === "Expired" ? "text-danger-fg" : "text-warning-fg"}`}>
          {daysText(document.days_left)}
        </span>
      )}
    </span>
  )
}

export function DocumentsPage() {
  const role = useSession().data?.role
  const admin = role === "admin"
  const [tab, setTab] = useState<Tab>("dashboard")
  const [categoryFilter, setCategoryFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const [adding, setAdding] = useState<DocumentRecord | null>(null)
  const [viewing, setViewing] = useState<DocumentRecord | null>(null)

  const documents = useList<DocumentRecord>("documents/documents")
  const categories = useList<DocumentCategory>("documents/categories")
  const expiring = useQuery<DocumentRecord[]>({ queryKey: ["documents/expiring"], queryFn: () => api("documents/expiring") })
  const summary = useQuery<DocumentSummary>({ queryKey: ["documents/summary"], queryFn: () => api("documents/summary") })

  const removers = {
    document: useDelete("documents/documents", { noun: "Document", invalidate: DOCUMENT_LISTS }),
    category: useDelete("documents/categories", { noun: "Category", invalidate: DOCUMENT_LISTS }),
  }

  const s = summary.data
  const rules = useMemo(
    () => (s ? { maxMb: s.max_upload_mb, extensions: s.allowed_extensions } : DEFAULT_RULES),
    [s],
  )

  const documentColumns = useMemo<TableColumn<DocumentRecord>[]>(() => [
    { accessorKey: "title", header: "Document",
      cell: ({ row }) => (
        <span className="block max-w-72">
          <span className="block truncate font-medium" title={row.original.title}>{row.original.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {row.original.number}{row.original.reference_number && ` · ${row.original.reference_number}`}
          </span>
        </span>
      ) },
    { accessorKey: "category_name", header: "Category" },
    { id: "linked", header: "Belongs to", accessorFn: (r) => (r.linked_type ? `${r.linked_type} ${r.linked_label}` : ""),
      cell: ({ row }) => row.original.linked_type ? (
        <span className="block max-w-56">
          <span className="block truncate" title={row.original.linked_label}>{row.original.linked_label || "—"}</span>
          <span className="block text-xs text-muted-foreground">{row.original.linked_type}</span>
        </span>
      ) : <span className="text-muted-foreground">—</span> },
    { id: "file", header: "File", accessorFn: (r) => r.file_name,
      cell: ({ row }) => (
        <span className="block max-w-56">
          <span className="block truncate" title={row.original.file_name}>{row.original.file_name}</span>
          <span className="block text-xs text-muted-foreground">Version {row.original.current_version} · {fileSize(row.original.size_bytes)}</span>
        </span>
      ) },
    { id: "expires_on", header: "Expires", sortFn: "datetime",
      accessorFn: (r) => (r.expires_on ? new Date(r.expires_on) : new Date(8.64e15)),
      cell: ({ row }) => <ExpiryCell document={row.original} /> },
    { accessorKey: "status", header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} tone={STATUS_TONES[row.original.status]} /> },
    { accessorKey: "created_by_name", header: "Uploaded by", cell: ({ getValue }) => <NameWithAvatar name={getValue<string>()} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const d = row.original
        const extra = [{ label: "Download", icon: <Download className="size-4" />, onSelect: () => { void downloadDocument(d) } }]
        if (d.can_change) extra.push({ label: "New version", icon: <FilePlus2 className="size-4" />, onSelect: () => setAdding(d) })
        extra.push({ label: "Versions", icon: <History className="size-4" />, onSelect: () => setViewing(d) })
        if (d.can_change) extra.push({ label: "Edit details", icon: <Pencil className="size-4" />, onSelect: () => setEditing({ kind: "document", record: d }) })
        return <RowActions extra={extra}
          onDelete={admin ? () => setDeleting({ kind: "document", id: d.id, label: `${d.number} ${d.title}` }) : undefined} />
      } },
  ], [admin])

  const categoryColumns = useMemo<TableColumn<DocumentCategory>[]>(() => [
    { accessorKey: "name", header: "Category",
      cell: ({ row }) => (
        <span className="block max-w-80">
          <span className="block truncate font-medium">{row.original.name}</span>
          {row.original.description && <span className="block truncate text-xs text-muted-foreground" title={row.original.description}>{row.original.description}</span>}
        </span>
      ) },
    { id: "roles", header: "Who can see it", accessorFn: (r) => ["Admin", ...r.allowed_roles.map((x) => ROLE_LABELS[x])].join(", "),
      cell: ({ row }) => row.original.allowed_roles.length === 0
        ? <span className="text-muted-foreground">Admin only</span>
        : row.original.allowed_roles.length === 4 ? "All roles"
          : <span className="block max-w-80 truncate" title={row.original.allowed_roles.map((x) => ROLE_LABELS[x]).join(", ")}>
              Admin, {row.original.allowed_roles.map((x) => ROLE_LABELS[x]).join(", ")}
            </span> },
    { accessorKey: "documents", header: "Documents", sortFn: "basic", cell: ({ getValue }) => plural(getValue<number>(), "document") },
    { id: "is_active", header: "Status", accessorFn: (r) => (r.is_active ? "In use" : "Not in use"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "In use" : "Not in use"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => admin ? <RowActions onEdit={() => setEditing({ kind: "category", record: row.original })}
        onDelete={() => setDeleting({ kind: "category", id: row.original.id, label: row.original.name })} /> : null },
  ], [admin])

  const canUpload = (categories.data ?? []).some((c) => c.is_active)
  const uploadAction = canUpload ? { label: "Upload document", icon: Upload, open: () => setEditing({ kind: "document", record: null }) } : null
  const addFor: Record<Tab, typeof uploadAction> = {
    dashboard: uploadAction,
    documents: uploadAction,
    expiring: uploadAction,
    categories: admin ? { label: "New category", icon: Plus, open: () => setEditing({ kind: "category", record: null }) } : null,
  }

  const core = [documents, summary]
  const loadError = core.find((q) => q.isError)
  const add = addFor[tab]
  const shown = (documents.data ?? []).filter((d) =>
    (categoryFilter === ALL || String(d.category) === categoryFilter) && (statusFilter === ALL || d.status === statusFilter))
  const next = (expiring.data ?? []).slice(0, 8)
  const largest = Math.max(1, ...(s?.by_category ?? []).map((c) => c.count))

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Documents" icon="documents"
        description="Certificates, test reports, safety data sheets and other files, with versions and expiry dates."
        actions={add && <Button onClick={add.open}><add.icon className="size-4" /> {add.label}</Button>} />

      {loadError ? (
        <ErrorState message={loadError.error!.message} onRetry={() => core.forEach((q) => q.refetch())} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="expiring">Expiring</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4 space-y-6">
            {!s ? <CardsSkeleton /> : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Documents" icon={Files} tone="documents" value={s.documents}
                    hint={plural(s.by_category.length, "category", "categories")} muted={s.documents === 0} />
                  <StatCard label="Expiring soon" icon={CalendarClock} tone={s.expiring_soon ? "warning" : "success"} value={s.expiring_soon}
                    hint={`Within ${s.expiring_days} days`} muted={s.expiring_soon === 0} />
                  <StatCard label="Expired" icon={CalendarX} tone={s.expired ? "danger" : "success"} value={s.expired}
                    hint={s.expired ? "Renew them or upload a new version" : "Nothing has expired"} muted={s.expired === 0} />
                  <StatCard label="Added, this month" icon={FilePlus2} tone="info" value={s.added_this_month}
                    hint={`${s.no_expiry} without an expiry date`} muted={s.added_this_month === 0} />
                </div>

                <div className="grid gap-4 lg:grid-cols-5">
                  <Card className="animate-rise lg:col-span-3">
                    <CardHeader>
                      <CardTitle>Expires next</CardTitle>
                      <CardDescription className="mt-0.5">Expired documents and those ending within {s.expiring_days} days</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {next.length ? next.map((d) => (
                        <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                          <div className="min-w-0 flex-1 basis-40">
                            <p className="truncate text-sm font-medium" title={d.title}>{d.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {d.category_name} · {date(d.expires_on)} · {daysText(d.days_left)}
                            </p>
                          </div>
                          <StatusBadge status={d.status} tone={STATUS_TONES[d.status]} />
                          <Button size="sm" variant="outline" aria-label={`Download ${d.title}`} onClick={() => { void downloadDocument(d) }}>
                            <Download className="size-3.5" /> Download
                          </Button>
                        </div>
                      )) : (
                        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                          <CheckCircle2 className="size-4 text-success-fg" aria-hidden /> Nothing expires in the next {s.expiring_days} days.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="animate-rise lg:col-span-2">
                    <CardHeader>
                      <CardTitle>By category</CardTitle>
                      <CardDescription className="mt-0.5">Documents you can see</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3.5">
                      {s.by_category.length ? s.by_category.map((c) => (
                        <div key={c.category}>
                          <div className="mb-1.5 flex justify-between gap-2 text-sm">
                            <span className="truncate font-medium">{c.name}</span>
                            <span className="shrink-0 text-muted-foreground">{c.count}</span>
                          </div>
                          <ProgressBar value={(c.count / largest) * 100} size="sm" tone="documents" label={`${c.name} documents`} />
                        </div>
                      )) : <EmptyState icon={Files} title="No documents yet" description="Add the first one with “Upload document”." />}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            {documents.isPending ? <TableSkeleton columns={8} /> : (
              <DataTable columns={documentColumns} data={shown} exportName="documents"
                searchPlaceholder="Search title, number, file, record…" emptyTitle="No documents"
                emptyDescription={canUpload ? "Add one with “Upload document”." : "Documents you may see show here."}
                filters={[
                  ...(categoryFilter !== ALL ? [{ label: `Category: ${categories.data?.find((c) => String(c.id) === categoryFilter)?.name ?? ""}`, onClear: () => setCategoryFilter(ALL) }] : []),
                  ...(statusFilter !== ALL ? [{ label: `Status: ${statusFilter}`, onClear: () => setStatusFilter(ALL) }] : []),
                ]}
                toolbar={<>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9 w-[190px]" aria-label="Category filter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All categories</SelectItem>
                      {(categories.data ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[160px]" aria-label="Status filter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All statuses</SelectItem>
                      {STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </>} />
            )}
          </TabsContent>

          <TabsContent value="expiring" className="mt-4">
            {expiring.isError ? <ErrorState message={expiring.error.message} onRetry={() => expiring.refetch()} />
              : expiring.isPending ? <TableSkeleton columns={8} /> : (
                <DataTable columns={documentColumns} data={expiring.data} exportName="documents-expiring"
                  searchPlaceholder="Search title, number, file, record…" emptyTitle="Nothing is expiring"
                  emptyDescription="Documents that have expired or end within 30 days show here."
                  initialSorting={[{ id: "expires_on", desc: false }]} />
              )}
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            {categories.isError ? <ErrorState message={categories.error.message} onRetry={() => categories.refetch()} />
              : categories.isPending ? <TableSkeleton columns={5} /> : (
                <DataTable columns={categoryColumns} data={categories.data} exportName="document-categories"
                  searchPlaceholder="Search category…" emptyTitle="No categories"
                  emptyDescription={admin ? "Add one with “New category”." : "An admin has not opened a category to your role yet."} />
              )}
          </TabsContent>
        </Tabs>
      )}

      <DocumentDialog open={editing?.kind === "document"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "document" ? editing.record : null} categories={categories.data ?? []} admin={admin} rules={rules} />
      <CategoryDialog open={editing?.kind === "category"} onOpenChange={(o) => !o && setEditing(null)}
        record={editing?.kind === "category" ? editing.record : null} />
      <VersionDialog document={adding} onOpenChange={(o) => !o && setAdding(null)} rules={rules} />
      <VersionsSheet document={viewing} onOpenChange={(o) => !o && setViewing(null)} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.label}?`}
        description={deleting?.kind === "document"
          ? "The document and the files of all its versions are removed for good."
          : "The category is removed. A category that still holds documents can't be deleted."}
        onConfirm={async () => {
          if (deleting) await removers[deleting.kind].mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
