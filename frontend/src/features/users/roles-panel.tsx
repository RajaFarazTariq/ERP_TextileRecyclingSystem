"use client"

// Roles and their duties: the roles an organisation works with, and what each may do beyond opening pages.
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BadgeCheck, Lock, Plus, RotateCcw, Save, Users } from "lucide-react"
import { Fragment, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Field, FormDialog } from "@/components/common/form-dialog"
import { RowActions } from "@/components/common/row-actions"
import { SelectField } from "@/components/common/select-field"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { applyServerErrors } from "@/lib/forms"

export interface AccessRole {
  key: string
  label: string
  /** The admin role: shown, never changed */
  locked: boolean
  is_system: boolean
}

interface RoleRow {
  id: number
  key: string
  name: string
  description: string
  is_system: boolean
  users: number
}

interface DutyInfo {
  key: string
  title: string
  description: string
  /** The page the duty is used on; a role needs that page too */
  page: string
}

interface DutyMatrix {
  duties: DutyInfo[]
  roles: AccessRole[]
  matrix: Record<string, string[]>
  /** What the built-in roles started with */
  defaults: Record<string, string[]>
}

const ROLES_KEY = ["access/roles"]
const DUTIES_KEY = ["access/duties"]
/** Everything that names roles or depends on what a role holds */
const ROLE_DEPENDENTS = [ROLES_KEY, DUTIES_KEY, ["access/matrix"], ["access/role-names"], ["access/users"], ["users/list"], ["session"]]
const message = (error: unknown) => (error instanceof Error ? error.message : "Could not save.")
const sameSet = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((x) => b.includes(x))
const NO_COPY = "none"

// ─── Roles ──────────────────────────────────────────────────────────────────

const roleSchema = z.object({
  name: z.string().trim().min(1, "Enter a name for the role.").max(80, "Use at most 80 characters."),
  description: z.string().trim().max(255),
  copy_from: z.string(),
})
type RoleForm = z.infer<typeof roleSchema>

function RoleDialog({ record, roles, onOpenChange }: { record: RoleRow | null; roles: RoleRow[]; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const [formError, setFormError] = useState("")
  const form = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: record?.name ?? "", description: record?.description ?? "", copy_from: NO_COPY },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    try {
      if (record) {
        await api(`access/roles/${record.id}`, { method: "PATCH", body: { name: values.name, description: values.description } })
        toast.success("Role updated.")
      } else {
        const copy_from = values.copy_from === NO_COPY ? "" : values.copy_from
        await api("access/roles", { method: "POST", body: { name: values.name, description: values.description, copy_from } })
        toast.success(copy_from ? "Role added with the same pages and duties." : "Role added. Give it pages and duties below.")
      }
      ROLE_DEPENDENTS.forEach((key) => qc.invalidateQueries({ queryKey: key }))
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values)))
    }
  })

  return (
    <FormDialog open onOpenChange={onOpenChange} title={record ? `Edit ${record.name}` : "Add role"}
      description="A role is a job in your organisation, such as Accountant or Store Keeper. Each person has one role."
      error={formError} submitting={isSubmitting} submitLabel={record ? "Update" : "Add role"} onSubmit={onSubmit}>
      <Field id="role-name" label="Name" error={errors.name?.message}>
        <Input id="role-name" autoComplete="off" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <Field id="role-description" label="What the role is for" error={errors.description?.message}>
        <Input id="role-description" autoComplete="off" {...form.register("description")} />
      </Field>
      {!record && (
        <Field id="role-copy" label="Start with the pages and duties of" hint="You can change them afterwards">
          <Controller control={form.control} name="copy_from" render={({ field }) => (
            <SelectField id="role-copy" value={field.value} onChange={field.onChange} placeholder="Select"
              options={[{ value: NO_COPY, label: "Nothing (start empty)" },
                ...roles.filter((r) => r.key !== "admin").map((r) => ({ value: r.key, label: r.name }))]} />
          )} />
        </Field>
      )}
    </FormDialog>
  )
}

function RoleList({ roles }: { roles: RoleRow[] }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<{ record: RoleRow | null } | null>(null)
  const [deleting, setDeleting] = useState<RoleRow | null>(null)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2"><Users className="size-4" aria-hidden /> Roles</CardTitle>
          <CardDescription className="mt-0.5">
            The jobs in your organisation. Add your own, then choose their pages and duties below.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing({ record: null })}><Plus className="size-4" /> Add role</Button>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <li key={role.key} className="flex items-center gap-3 rounded-lg border px-3 py-2.5" data-role={role.key}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="truncate">{role.name}</span>
                  {role.is_system && <Badge variant="outline"><Lock aria-hidden /> Built-in</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground" title={role.description}>
                  {role.users} {role.users === 1 ? "user" : "users"}{role.description && ` · ${role.description}`}
                </p>
              </div>
              {!role.is_system && (
                <RowActions onEdit={() => setEditing({ record: role })} onDelete={() => setDeleting(role)} />
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          The built-in roles can&apos;t be renamed or deleted, but their pages and duties can be changed. A role that people still have can&apos;t be deleted.
        </p>
      </CardContent>

      {editing && <RoleDialog key={editing.record?.id ?? "new"} record={editing.record} roles={roles} onOpenChange={(o) => !o && setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete the role ${deleting?.name}?`}
        description="Its pages and duties are removed with it. A role that people still have can't be deleted: give them another role first."
        onConfirm={async () => {
          if (!deleting) return
          await api(`access/roles/${deleting.id}`, { method: "DELETE" })
          toast.success("Role deleted.")
          ROLE_DEPENDENTS.forEach((key) => qc.invalidateQueries({ queryKey: key }))
        }}
      />
    </Card>
  )
}

// ─── Duties ─────────────────────────────────────────────────────────────────

function DutyGrid({ data, pageTitles }: { data: DutyMatrix; pageTitles: Record<string, string> }) {
  const qc = useQueryClient()
  // Unsaved choices; null while nothing has been changed
  const [draft, setDraft] = useState<Record<string, string[]> | null>(null)
  const [saving, setSaving] = useState(false)
  const current = draft ?? data.matrix
  const editable = data.roles.filter((r) => !r.locked)
  const dirty = editable.some((r) => !sameSet(current[r.key], data.matrix[r.key]))
  // "Original" puts the built-in roles back; roles an admin added have no original
  const atDefaults = editable.every((r) => !(r.key in data.defaults) || sameSet(current[r.key], data.defaults[r.key]))

  const toggle = (role: string, duty: string, on: boolean) => {
    const duties = (current[role] ?? []).filter((d) => d !== duty)
    setDraft({ ...current, [role]: on ? [...duties, duty] : duties })
  }

  const save = async () => {
    setSaving(true)
    try {
      const roles = Object.fromEntries(editable.map((r) => [r.key, current[r.key] ?? []]))
      const saved = await api<DutyMatrix>("access/duties", { method: "PUT", body: { roles } })
      qc.setQueryData(DUTIES_KEY, saved)
      qc.invalidateQueries({ queryKey: ["session"] })
      setDraft(null)
      toast.success("Duties saved. They apply from each user's next action.")
    } catch (error) {
      toast.error(message(error))
    } finally {
      setSaving(false)
    }
  }

  const groups: { page: string; duties: DutyInfo[] }[] = []
  for (const duty of data.duties) {
    const group = groups.find((g) => g.page === duty.page)
    if (group) group.duties.push(duty)
    else groups.push({ page: duty.page, duties: [duty] })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2"><BadgeCheck className="size-4" aria-hidden /> Duties by role</CardTitle>
          <CardDescription className="mt-0.5">
            What a role may do beyond opening a page: approving, releasing, paying. A duty only works for a role that also has its page in full.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={saving || atDefaults}
            onClick={() => setDraft({ ...current, ...data.defaults })}>
            <RotateCcw className="size-4" /> Original duties
          </Button>
          <Button variant="outline" size="sm" disabled={saving || !dirty} onClick={() => setDraft(null)}>Discard</Button>
          <Button size="sm" disabled={saving || !dirty} onClick={save}><Save className="size-4" /> Save duties</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="scrollbar-thin overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" style={{ minWidth: `${22 + data.roles.length * 7}rem` }}>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium">
                <th className="text-left">Duty</th>
                {data.roles.map((r) => (
                  <th key={r.key} className="w-28 text-center">
                    <span className="block leading-tight">{r.label.replace(" Supervisor", "")}</span>
                    <span className="block text-[11px] font-normal">{r.locked ? "always all" : `${(current[r.key] ?? []).length} ${(current[r.key] ?? []).length === 1 ? "duty" : "duties"}`}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.page}>
                  <tr className="border-b bg-muted/40">
                    <td colSpan={data.roles.length + 1} className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {pageTitles[group.page] ?? group.page}
                    </td>
                  </tr>
                  {group.duties.map((duty) => (
                    <tr key={duty.key} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <span className="block font-medium">{duty.title}</span>
                        <span className="block text-xs text-muted-foreground">{duty.description}</span>
                      </td>
                      {data.roles.map((r) => {
                        const on = r.locked || (current[r.key] ?? []).includes(duty.key)
                        return (
                          <td key={r.key} className="px-3 py-2 text-center">
                            <Checkbox checked={on} disabled={r.locked || saving} aria-label={`${r.label}: ${duty.title}`}
                              onCheckedChange={(v) => toggle(r.key, duty.key, v === true)} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Admins always have every duty, so there is always someone who can approve.
          {dirty && <span className="ml-1 font-medium text-warning-fg">You have unsaved changes.</span>}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Both, for the Access tab ───────────────────────────────────────────────

export function RolesCard() {
  const roles = useQuery<RoleRow[]>({ queryKey: ROLES_KEY, queryFn: () => api("access/roles") })
  if (roles.isError) return <ErrorState message={roles.error.message} onRetry={() => roles.refetch()} />
  if (!roles.data) return <TableSkeleton columns={3} rows={2} />
  return <RoleList roles={roles.data} />
}

export function DutiesCard({ pageTitles }: { pageTitles: Record<string, string> }) {
  const duties = useQuery<DutyMatrix>({ queryKey: DUTIES_KEY, queryFn: () => api("access/duties") })
  if (duties.isError) return <ErrorState message={duties.error.message} onRetry={() => duties.refetch()} />
  if (!duties.data) return <TableSkeleton columns={6} />
  return <DutyGrid data={duties.data} pageTitles={pageTitles} />
}
