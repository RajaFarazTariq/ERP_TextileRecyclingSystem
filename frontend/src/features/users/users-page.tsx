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
import { useSession } from "@/features/auth/use-session"
import { ApiError, api } from "@/lib/api"
import { useList } from "@/lib/crud"
import { applyServerErrors } from "@/lib/forms"
import type { Role, UserSummary } from "@/types/api"

const ROLES = Object.keys(ROLE_LABELS) as Role[]
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
      cell: ({ row }) => <span className="font-medium">{row.original.username}{row.original.id === myId && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</span> },
    { accessorKey: "email", header: "Email", cell: ({ getValue }) => getValue<string>() || "—" },
    { id: "role", header: "Role", accessorFn: (r) => ROLE_LABELS[r.role], cell: ({ row }) => ROLE_LABELS[row.original.role] },
    { id: "status", header: "Status", accessorFn: (r) => (r.is_active ? "Active" : "Inactive"),
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "Active" : "Inactive"} tone={row.original.is_active ? "success" : "neutral"} /> },
    { id: "last_login", header: "Last login", accessorFn: (r) => (r.last_login ? new Date(r.last_login) : new Date(0)), sortFn: "datetime",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.last_login_display}</span> },
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
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Users" description="Who can sign in, and what each role can open."
        actions={<Button onClick={() => setEditing({ record: null })}><Plus className="size-4" /> Add user</Button>} />

      {users.isError ? <ErrorState message={users.error.message} onRetry={() => users.refetch()} />
        : users.isPending ? <TableSkeleton columns={5} />
        : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {counts.map((c) => (
                <Card key={c.role} className="gap-0 py-3">
                  <CardContent className="px-4">
                    <p className="text-2xl font-semibold tabular-nums">{c.count}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[c.role]}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <DataTable columns={columns} data={users.data} searchPlaceholder="Search username, email, role…" emptyTitle="No users" />
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
