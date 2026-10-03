"use client"

// Access management: the roles, which pages each may open and how far, their duties, and exceptions for one person.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, Lock, Pencil, RotateCcw, Save, ShieldCheck, UserCog } from "lucide-react"
import { Fragment, useState } from "react"
import { toast } from "sonner"

import { NavIcon } from "@/components/layout/nav-icon"
import { SelectField } from "@/components/common/select-field"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { NavIcon as NavIconName } from "@/config/access"
import { NAV_TONES } from "@/config/nav-tones"
import { api } from "@/lib/api"
import { displayName } from "@/lib/format"
import { TONE } from "@/lib/tones"
import { cn } from "@/lib/utils"
import type { AccessLevel, Role, UserSummary } from "@/types/api"
import { type AccessRole, DutiesCard, RolesCard } from "./roles-panel"

type Level = AccessLevel | "none"
type Levels = Record<string, AccessLevel>

interface AccessPage {
  key: string
  title: string
  group: string
  /** Only admins may ever have it */
  admin_only: boolean
  /** The page only shows things, so "view" and "full" are the same */
  read_only: boolean
}

interface AccessMatrix {
  pages: AccessPage[]
  roles: AccessRole[]
  matrix: Record<Role, Levels>
  /** What each role had before access became configurable */
  defaults: Partial<Record<Role, Levels>>
  users_with_exceptions: number
}

interface UserAccess {
  user: number
  username: string
  role: Role
  role_levels: Levels
  /** This person's own level for a page; "none" takes the page away */
  overrides: Record<string, Level>
  levels: Levels
}

const MATRIX_KEY = ["access/matrix"]
const same = (a: Record<string, string>, b: Record<string, string>) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
const message = (error: unknown) => (error instanceof Error ? error.message : "Could not save.")
const LEVEL_TEXT: Record<Level, string> = { none: "No access", view: "View only", full: "Full" }
/** What a level is called for this page: a page that only shows things is simply "Can open". */
const levelText = (page: AccessPage, level: Level) => (page.read_only && level !== "none" ? "Can open" : LEVEL_TEXT[level])
const choicesFor = (page: AccessPage): Level[] => (page.read_only ? ["none", "full"] : ["none", "view", "full"])

function LevelBadge({ page, level }: { page: AccessPage; level: Level }) {
  if (level === "none") return <Badge variant="secondary" className="shrink-0">No access</Badge>
  if (level === "view" && !page.read_only) return <Badge variant="outline" className="shrink-0"><Eye aria-hidden /> View only</Badge>
  return <Badge className="shrink-0">{page.read_only ? "Can open" : <><Pencil aria-hidden /> Full</>}</Badge>
}

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
  // Unsaved choices; null while nothing has been changed
  const [draft, setDraft] = useState<Record<string, Levels> | null>(null)
  const [saving, setSaving] = useState(false)
  const current: Record<string, Levels> = draft ?? data.matrix
  const editable = data.roles.filter((r) => !r.locked)
  const dirty = editable.some((r) => !same(current[r.key] ?? {}, data.matrix[r.key] ?? {}))
  // "Original" puts the built-in roles back; roles an admin added have no original
  const atDefaults = editable.every((r) => !(r.key in data.defaults) || same(current[r.key] ?? {}, data.defaults[r.key] ?? {}))

  const choose = (role: Role, page: string, level: Level) => {
    const levels = { ...(current[role] ?? {}) }
    if (level === "none") delete levels[page]
    else levels[page] = level
    setDraft({ ...current, [role]: levels })
  }

  const save = async () => {
    setSaving(true)
    try {
      const roles = Object.fromEntries(editable.map((r) => [r.key, current[r.key] ?? {}]))
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
            Choose how far each role goes on each page: no access, view only, or full (look and change).
            Who may approve things is set under Duties by role.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={saving || atDefaults}
            onClick={() => setDraft({ ...current, ...(data.defaults as Record<string, Levels>) })}>
            <RotateCcw className="size-4" /> Original access
          </Button>
          <Button variant="outline" size="sm" disabled={saving || !dirty} onClick={() => setDraft(null)}>Discard</Button>
          <Button size="sm" disabled={saving || !dirty} onClick={save}><Save className="size-4" /> Save changes</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="scrollbar-thin overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" style={{ minWidth: `${14 + data.roles.length * 9}rem` }}>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium">
                <th className="text-left">Page</th>
                {data.roles.map((r) => (
                  <th key={r.key} className="w-36 text-left">
                    <span className="block leading-tight">{r.label.replace(" Supervisor", "")}</span>
                    <span className="block text-[11px] font-normal">{r.locked ? "always full" : `${Object.keys(current[r.key] ?? {}).length} pages`}</span>
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
                        const level: Level = r.locked ? "full" : page.admin_only ? "none" : (current[r.key]?.[page.key] ?? "none")
                        if (r.locked || page.admin_only) {
                          return (
                            <td key={r.key} className="px-3 py-2 text-xs text-muted-foreground" data-level={level}>
                              <span className="inline-flex items-center gap-1.5"><Lock className="size-3" aria-hidden /> {levelText(page, level)}</span>
                            </td>
                          )
                        }
                        return (
                          <td key={r.key} className="px-3 py-1.5">
                            <Select value={level} onValueChange={(v) => choose(r.key, page.key, v as Level)} disabled={saving}>
                              <SelectTrigger aria-label={`${r.label}: ${page.title}`} data-level={level}
                                className={cn("h-8 w-full text-[13px]", level === "none" && "text-muted-foreground", level === "full" && "border-brand/40")}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {choicesFor(page).map((l) => <SelectItem key={l} value={l}>{levelText(page, l)}</SelectItem>)}
                              </SelectContent>
                            </Select>
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
          Admins always have every page in full, and Users stays with admins, so there is always someone who can manage access.
          {dirty && <span className="ml-1 font-medium text-warning-fg">You have unsaved changes.</span>}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── One person ─────────────────────────────────────────────────────────────

type Choice = "role" | Level

function UserExceptions({ users, pages, withExceptions }: { users: UserSummary[]; pages: AccessPage[]; withExceptions: number }) {
  const qc = useQueryClient()
  const [userId, setUserId] = useState("")
  const [draft, setDraft] = useState<Record<string, Level> | null>(null)
  const [saving, setSaving] = useState(false)
  const access = useQuery<UserAccess>({
    queryKey: ["access/users", userId], queryFn: () => api(`access/users/${userId}`), enabled: !!userId,
  })
  const data = access.data
  const overrides: Record<string, Level> = draft ?? data?.overrides ?? {}
  const dirty = !!data && !same(overrides, data.overrides)
  const grantable = pages.filter((p) => !p.admin_only)

  const choose = (page: string, choice: Choice) => {
    const next = { ...overrides }
    if (choice === "role") delete next[page]
    else next[page] = choice
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
          Give someone more or less than their role on a page, without changing the role for everyone.
          {withExceptions > 0 && ` ${withExceptions} ${withExceptions === 1 ? "person has" : "people have"} exceptions now.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid w-full gap-1.5 sm:w-80">
            <label htmlFor="access-user" className="text-[13px] font-medium">User</label>
            <SelectField id="access-user" value={userId} placeholder="Select a user"
              onChange={(v) => { setUserId(v); setDraft(null) }}
              options={users.filter((u) => u.role !== "admin").map((u) => ({ value: String(u.id), label: `${displayName(u.username)} (${u.role_label})` }))} />
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
                const fromRole: Level = data.role_levels[page.key] ?? "none"
                const choice: Choice = page.key in overrides ? overrides[page.key] : "role"
                const result: Level = choice === "role" ? fromRole : choice
                return (
                  <li key={page.key} className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border px-3 py-2",
                    choice !== "role" && "border-warning/40 bg-warning/5")}>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <PageName page={page} />
                      <LevelBadge page={page} level={result} />
                    </span>
                    <Select value={choice} onValueChange={(v) => choose(page.key, v as Choice)} disabled={saving}>
                      <SelectTrigger className="h-8 w-48" aria-label={`Access to ${page.title}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="role">As the role ({levelText(page, fromRole).toLowerCase()})</SelectItem>
                        {choicesFor(page).filter((l) => l !== fromRole).map((l) => <SelectItem key={l} value={l}>{levelText(page, l)}</SelectItem>)}
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
      <RolesCard />
      <RoleMatrix data={matrix.data} />
      <DutiesCard pageTitles={Object.fromEntries(matrix.data.pages.map((p) => [p.key, p.title]))} />
      <UserExceptions users={users} pages={matrix.data.pages} withExceptions={matrix.data.users_with_exceptions} />
    </div>
  )
}
