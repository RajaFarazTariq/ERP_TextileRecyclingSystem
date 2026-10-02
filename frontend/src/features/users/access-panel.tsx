"use client"

// Access management: which pages each role may open, and exceptions for one person.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Lock, RotateCcw, Save, ShieldCheck, UserCog } from "lucide-react"
import { Fragment, useState } from "react"
import { toast } from "sonner"

import { NavIcon } from "@/components/layout/nav-icon"
import { SelectField } from "@/components/common/select-field"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ROLE_LABELS, type NavIcon as NavIconName } from "@/config/access"
import { NAV_TONES } from "@/config/nav-tones"
import { api } from "@/lib/api"
import { displayName } from "@/lib/format"
import { TONE } from "@/lib/tones"
import { cn } from "@/lib/utils"
import type { Role, UserSummary } from "@/types/api"

interface AccessPage {
  key: string
  title: string
  group: string
  /** Only admins may ever have it */
  admin_only: boolean
}

interface AccessMatrix {
  pages: AccessPage[]
  roles: { key: Role; label: string; locked: boolean }[]
  matrix: Record<Role, string[]>
  /** What each role had before access became configurable */
  defaults: Partial<Record<Role, string[]>>
  users_with_exceptions: number
}

interface UserAccess {
  user: number
  username: string
  role: Role
  role_pages: string[]
  /** true = given to this person, false = taken away */
  overrides: Record<string, boolean>
  pages: string[]
}

const MATRIX_KEY = ["access/matrix"]
const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join()
const message = (error: unknown) => (error instanceof Error ? error.message : "Could not save.")

function PageName({ page }: { page: AccessPage }) {
  const icon = page.key as NavIconName
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", TONE[NAV_TONES[icon]].soft, TONE[NAV_TONES[icon]].text)}>
        <NavIcon name={icon} className="size-3.5" />
      </span>
      <span className="truncate font-medium">{page.title}</span>
      {page.admin_only && <Badge variant="outline" title="Only admins can manage users and access"><Lock aria-hidden /> Admins only</Badge>}
    </span>
  )
}

/** Pages listed under their menu group. */
function groupsOf(pages: AccessPage[]) {
  const groups: { label: string; pages: AccessPage[] }[] = []
  for (const page of pages) {
    const group = groups.find((g) => g.label === page.group)
    if (group) group.pages.push(page)
    else groups.push({ label: page.group, pages: [page] })
  }
  return groups
}

// ─── Roles ──────────────────────────────────────────────────────────────────

function RoleMatrix({ data }: { data: AccessMatrix }) {
  const qc = useQueryClient()
  // Unsaved ticks; null while nothing has been changed
  const [draft, setDraft] = useState<Record<string, string[]> | null>(null)
  const [saving, setSaving] = useState(false)
  const current = draft ?? data.matrix
  const editable = data.roles.filter((r) => !r.locked)
  const dirty = editable.some((r) => !same(current[r.key] ?? [], data.matrix[r.key] ?? []))
  const atDefaults = editable.every((r) => same(current[r.key] ?? [], data.defaults[r.key] ?? []))

  const toggle = (role: Role, page: string, on: boolean) => {
    const pages = new Set(current[role] ?? [])
    if (on) pages.add(page)
    else pages.delete(page)
    setDraft({ ...current, [role]: [...pages] })
  }

  const save = async () => {
    setSaving(true)
    try {
      const roles = Object.fromEntries(editable.map((r) => [r.key, current[r.key] ?? []]))
      const saved = await api<AccessMatrix>("access/matrix", { method: "PUT", body: { roles } })
      qc.setQueryData(MATRIX_KEY, saved)
      qc.invalidateQueries({ queryKey: ["access/users"] })
      setDraft(null)
      toast.success("Page access saved. It applies from each user's next page.")
    } catch (error) {
      toast.error(message(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" aria-hidden /> Pages by role</CardTitle>
          <CardDescription className="mt-0.5">
            Tick the pages each role may open. A page also opens the records behind it; who may approve or change them is not affected.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={saving || atDefaults}
            onClick={() => setDraft({ ...current, ...data.defaults })}>
            <RotateCcw className="size-4" /> Original access
          </Button>
          <Button variant="outline" size="sm" disabled={saving || !dirty} onClick={() => setDraft(null)}>Discard</Button>
          <Button size="sm" disabled={saving || !dirty} onClick={save}><Save className="size-4" /> Save changes</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="scrollbar-thin overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium">
                <th className="text-left">Page</th>
                {data.roles.map((r) => (
                  <th key={r.key} className="w-28 text-center">
                    <span className="block leading-tight">{r.label.replace(" Supervisor", "")}</span>
                    <span className="block text-[11px] font-normal">{r.locked ? "always all" : `${(current[r.key] ?? []).length} pages`}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupsOf(data.pages).map((group) => (
                <Fragment key={group.label}>
                  <tr className="border-b bg-muted/40">
                    <td colSpan={data.roles.length + 1} className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</td>
                  </tr>
                  {group.pages.map((page) => (
                    <tr key={page.key} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2"><PageName page={page} /></td>
                      {data.roles.map((r) => {
                        const fixed = r.locked || page.admin_only
                        const checked = r.locked || (!page.admin_only && (current[r.key] ?? []).includes(page.key))
                        return (
                          <td key={r.key} className="px-3 py-2 text-center">
                            <Checkbox checked={checked} disabled={fixed || saving} className="mx-auto"
                              aria-label={`${r.label}: ${page.title}`}
                              onCheckedChange={(on) => toggle(r.key, page.key, on === true)} />
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
          Admins always have every page, and Users stays with admins, so there is always someone who can manage access.
          {dirty && <span className="ml-1 font-medium text-warning-fg">You have unsaved changes.</span>}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── One person ─────────────────────────────────────────────────────────────

type Choice = "role" | "allow" | "deny"

function UserExceptions({ users, pages, withExceptions }: { users: UserSummary[]; pages: AccessPage[]; withExceptions: number }) {
  const qc = useQueryClient()
  const [userId, setUserId] = useState("")
  const [draft, setDraft] = useState<Record<string, boolean> | null>(null)
  const [saving, setSaving] = useState(false)
  const access = useQuery<UserAccess>({
    queryKey: ["access/users", userId], queryFn: () => api(`access/users/${userId}`), enabled: !!userId,
  })
  const data = access.data
  const overrides = draft ?? data?.overrides ?? {}
  const dirty = !!data && JSON.stringify(Object.entries(overrides).sort()) !== JSON.stringify(Object.entries(data.overrides).sort())
  const grantable = pages.filter((p) => !p.admin_only)

  const choose = (page: string, choice: Choice) => {
    const next = { ...overrides }
    if (choice === "role") delete next[page]
    else next[page] = choice === "allow"
    setDraft(next)
  }

  const save = async () => {
    setSaving(true)
    try {
      const saved = await api<UserAccess>(`access/users/${userId}`, { method: "PUT", body: { overrides } })
      qc.setQueryData(["access/users", userId], saved)
      qc.invalidateQueries({ queryKey: MATRIX_KEY })
      setDraft(null)
      toast.success(`Access of ${displayName(saved.username)} saved.`)
    } catch (error) {
      toast.error(message(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserCog className="size-4" aria-hidden /> Exceptions for one person</CardTitle>
        <CardDescription className="mt-0.5">
          Give someone a page their role doesn&apos;t have, or take one away, without changing the role for everyone.
          {withExceptions > 0 && ` ${withExceptions} ${withExceptions === 1 ? "person has" : "people have"} exceptions now.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid w-full gap-1.5 sm:w-80">
            <label htmlFor="access-user" className="text-[13px] font-medium">User</label>
            <SelectField id="access-user" value={userId} placeholder="Select a user"
              onChange={(v) => { setUserId(v); setDraft(null) }}
              options={users.filter((u) => u.role !== "admin").map((u) => ({ value: String(u.id), label: `${displayName(u.username)} (${ROLE_LABELS[u.role]})` }))} />
          </div>
          {data && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" disabled={saving || !Object.keys(overrides).length} onClick={() => setDraft({})}>
                <RotateCcw className="size-4" /> Same as role
              </Button>
              <Button variant="outline" size="sm" disabled={saving || !dirty} onClick={() => setDraft(null)}>Discard</Button>
              <Button size="sm" disabled={saving || !dirty} onClick={save}><Save className="size-4" /> Save exceptions</Button>
            </div>
          )}
        </div>

        {!userId ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Choose a user to see their pages. Admins are not listed: they always have every page.
          </p>
        ) : access.isError ? <ErrorState message={access.error.message} onRetry={() => access.refetch()} />
          : !data ? <TableSkeleton columns={3} rows={5} />
          : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {grantable.map((page) => {
                const fromRole = data.role_pages.includes(page.key)
                const choice: Choice = page.key in overrides ? (overrides[page.key] ? "allow" : "deny") : "role"
                const result = choice === "role" ? fromRole : choice === "allow"
                return (
                  <li key={page.key} className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border px-3 py-2",
                    choice !== "role" && "border-warning/40 bg-warning/5")}>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <PageName page={page} />
                      <Badge variant={result ? "default" : "secondary"} className="shrink-0">{result ? "Can open" : "No access"}</Badge>
                    </span>
                    <Select value={choice} onValueChange={(v) => choose(page.key, v as Choice)} disabled={saving}>
                      <SelectTrigger className="h-8 w-44" aria-label={`Access to ${page.title}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="role">As the role ({fromRole ? "yes" : "no"})</SelectItem>
                        <SelectItem value="allow">Give access</SelectItem>
                        <SelectItem value="deny">Take away</SelectItem>
                      </SelectContent>
                    </Select>
                  </li>
                )
              })}
            </ul>
          )}
      </CardContent>
    </Card>
  )
}

export function AccessPanel({ users }: { users: UserSummary[] }) {
  const matrix = useQuery<AccessMatrix>({ queryKey: MATRIX_KEY, queryFn: () => api("access/matrix") })
  if (matrix.isError) return <ErrorState message={matrix.error.message} onRetry={() => matrix.refetch()} />
  if (!matrix.data) return <TableSkeleton columns={6} />
  return (
    <div className="space-y-4">
      <RoleMatrix data={matrix.data} />
      <UserExceptions users={users} pages={matrix.data.pages} withExceptions={matrix.data.users_with_exceptions} />
    </div>
  )
}
