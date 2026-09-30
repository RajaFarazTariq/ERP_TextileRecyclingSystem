"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Power, PowerOff } from "lucide-react"
import { useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, type TableColumn } from "@/components/common/data-table"
import { Field, FormDialog } from "@/components/common/form-dialog"
import { InitialsAvatar } from "@/components/common/identity"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { SelectField } from "@/components/common/select-field"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROLE_LABELS } from "@/config/access"
import { NAV_TONES } from "@/config/nav-tones"
import { NavIcon } from "@/components/layout/nav-icon"
import { useSession } from "@/features/auth/use-session"
import { ApiError, api } from "@/lib/api"
import { useList } from "@/lib/crud"
import { applyServerErrors } from "@/lib/forms"
import { relativeTime } from "@/lib/format"
import { TONE } from "@/lib/tones"
import { cn } from "@/lib/utils"
import type { Role, UserSummary } from "@/types/api"

const ROLES = Object.keys(ROLE_LABELS) as Role[]
// Each role takes the colour and icon of the module it runs
const ROLE_ICONS = {
  admin: "dashboard", warehouse_supervisor: "warehouse", sorting_supervisor: "sorting",
  decolorization_supervisor: "decolorization", drying_supervisor: "drying",
} as const satisfies Record<Role, keyof typeof NAV_TONES>
const ROLE_TONES = Object.fromEntries(ROLES.map((r) => [r, NAV_TONES[ROLE_ICONS[r]]])) as Record<Role, (typeof NAV_TONES)[keyof typeof NAV_TONES]>

function RoleBadge({ role }: { role: Role }) {
  const tone = TONE[ROLE_TONES[role]]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tone.soft, tone.text, tone.border)}>
      <NavIcon name={ROLE_ICONS[role]} className="size-3" />
      {ROLE_LABELS[role]}
    </span>
  )
}
const LISTS = [["users/list"]]

const userSchema = z.object({
  username: z.string().trim().min(1, "Enter a username.").max(150),
  email: z.string().trim().email("Enter a valid email address.").or(z.literal("")),
  password: z.string(),
  role: z.enum(ROLES as [Role, ...Role[]], { message: "Choose a role." }),
  is_active: z.boolean(),
})
type UserForm = z.infer<typeof userSchema>

function UserDialog({ record, open, onOpenChange, isSelf }: {
  record: UserSummary | null; open: boolean; onOpenChange: (o: boolean) => void; isSelf: boolean
}) {
  return open ? <UserDialogBody key={record?.id ?? "new"} record={record} onOpenChange={onOpenChange} isSelf={isSelf} /> : null
}

function UserDialogBody({ record, onOpenChange, isSelf }: { record: UserSummary | null; onOpenChange: (o: boolean) => void; isSelf: boolean }) {
  const qc = useQueryClient()
  const [formError, setFormError] = useState("")
  const form = useForm<UserForm>({
    resolver: zodResolver(
      record ? userSchema : userSchema.refine((v) => v.password.length > 0, { path: ["password"], message: "Set a password for the new user." }),
    ),
    defaultValues: {
      username: record?.username ?? "",
      email: record?.email ?? "",
      password: "",
      role: record?.role ?? ("" as Role),
      is_active: record?.is_active ?? true,
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      if (record) {
        const body: Partial<UserForm> = { ...values }
        if (!body.password) delete body.password   // blank = keep the current password
        await api(`users/detail/${record.id}`, { method: "PATCH", body })
        toast.success("User updated.")
      } else {
        await api("users/register", { method: "POST", body: values })
        toast.success("User created.")
      }
      LISTS.forEach((key) => qc.invalidateQueries({ queryKey: key }))
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open onOpenChange={onOpenChange} title={record ? `Edit ${record.username}` : "Add user"}
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Create user"} onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="username" label="Username" error={errors.username?.message}>
          <Input id="username" autoComplete="off" aria-invalid={!!errors.username} {...form.register("username")} />
        </Field>
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...form.register("email")} />
        </Field>
      </div>
      <Field id="password" label="Password" error={errors.password?.message}
        hint={record ? "Leave blank to keep the current password" : "At least 8 characters, not too common"}>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
      </Field>
      <Field id="role" label="Role" error={errors.role?.message} hint={isSelf ? "You can't change your own role" : undefined}>
        <Controller control={form.control} name="role" render={({ field }) => (
          <div aria-disabled={isSelf} className={isSelf ? "pointer-events-none opacity-60" : undefined}>
            <SelectField id="role" value={field.value} onChange={field.onChange} invalid={!!errors.role}
              placeholder="Select role" options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
          </div>
        )} />
      </Field>
      <Controller control={form.control} name="is_active" render={({ field }) => (
        <div className="flex items-center gap-2">
          <Checkbox id="is_active" checked={field.value} disabled={isSelf} onCheckedChange={(v) => field.onChange(v === true)} />
          <Label htmlFor="is_active">Account active (can sign in)</Label>
        </div>
      )} />
    </FormDialog>
  )
}

export function UsersPage() {
  const qc = useQueryClient()
  const me = useSession()
  const users = useList<UserSummary>("users/list")
  const [editing, setEditing] = useState<{ record: UserSummary | null } | null>(null)
  const [deleting, setDeleting] = useState<UserSummary | null>(null)

  const { mutate: toggleActive } = useMutation<{ is_active: boolean; username: string }, ApiError, number>({
    mutationFn: (id) => api(`users/toggle-active/${id}`, { method: "POST" }),
    onSuccess: (data) => {
      toast.success(`${data.username} ${data.is_active ? "activated" : "deactivated"}.`)
      LISTS.forEach((key) => qc.invalidateQueries({ queryKey: key }))
    },
    onError: (error) => toast.error(error.message),
  })

  const myId = me.data?.id
  const columns = useMemo<TableColumn<UserSummary>[]>(() => [
    { accessorKey: "username", header: "Username",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2.5">
          <InitialsAvatar name={row.original.username} />
          <span className="font-medium">{row.original.username}</span>
          {row.original.id === myId && <span className="rounded-md bg-brand/12 px-1.5 py-0.5 text-[11px] font-semibold text-brand-text"><span className="sr-only">(</span>you<span className="sr-only">)</span></span>}
        </span>
      ) },
    { accessorKey: "email", header: "Email", cell: ({ getValue }) => getValue<string>() || "—" },
    { id: "role", header: "Role", accessorFn: (r) => ROLE_LABELS[r.role], cell: ({ row }) => <RoleBadge role={row.original.role} /> },
    { id: "status", header: "Status", accessorFn: (r) => (r.is_active ? "Active" : "Inactive"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "Active" : "Inactive"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "last_login", header: "Last login", accessorFn: (r) => (r.last_login ? new Date(r.last_login) : new Date(0)), sortFn: "datetime",
      cell: ({ row }) => (
        <span className="text-muted-foreground" title={row.original.last_login_display}>
          {row.original.last_login ? relativeTime(row.original.last_login) : "Never"}
        </span>
      ) },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const u = row.original
        const self = u.id === myId
        return <RowActions
          extra={self ? [] : [{
            label: u.is_active ? "Deactivate" : "Activate",
            icon: u.is_active ? <PowerOff className="size-4" /> : <Power className="size-4" />,
            onSelect: () => toggleActive(u.id),
          }]}
          onEdit={() => setEditing({ record: u })}
          onDelete={self ? undefined : () => setDeleting(u)} />
      } },
  ], [myId, toggleActive])

  const counts = ROLES.map((r) => ({ role: r, count: (users.data ?? []).filter((u) => u.role === r).length }))

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Users" icon="users" description="Who can sign in, and what each role can open."
        actions={<Button onClick={() => setEditing({ record: null })}><Plus className="size-4" /> Add user</Button>} />

      {users.isError ? <ErrorState message={users.error.message} onRetry={() => users.refetch()} />
        : users.isPending ? <TableSkeleton columns={5} />
        : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {counts.map((c) => {
                const tone = TONE[ROLE_TONES[c.role]]
                return (
                  <Card key={c.role} className="animate-rise gap-0 py-4">
                    <CardContent className="flex items-center gap-3 px-4">
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone.soft, tone.text)}>
                        <NavIcon name={ROLE_ICONS[c.role]} className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-heading text-2xl leading-tight font-bold">{c.count}</p>
                        <p className="truncate text-xs text-muted-foreground">{ROLE_LABELS[c.role]}</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            <DataTable columns={columns} data={users.data} searchPlaceholder="Search username, email, role…" emptyTitle="No users" exportName="users" />
          </div>
        )}

      <UserDialog open={!!editing} record={editing?.record ?? null} onOpenChange={(o) => !o && setEditing(null)}
        isSelf={!!editing?.record && editing.record.id === myId} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.username}?`}
        description="Users who have recorded work can't be deleted; deactivate them instead so their history stays."
        onConfirm={async () => {
          if (!deleting) return
          await api(`users/detail/${deleting.id}`, { method: "DELETE" })
          toast.success("User deleted.")
          LISTS.forEach((key) => qc.invalidateQueries({ queryKey: key }))
        }}
      />
    </div>
  )
}
