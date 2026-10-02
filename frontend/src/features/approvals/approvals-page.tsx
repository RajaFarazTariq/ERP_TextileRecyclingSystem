"use client"

import { useQuery } from "@tanstack/react-query"
import { BellRing, CalendarClock, Hourglass, Inbox, Layers, Power, PowerOff } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { DataTable, type TableColumn } from "@/components/common/data-table"
import { NameWithAvatar } from "@/components/common/identity"
import { PageHeader } from "@/components/common/page-header"
import { RowActions } from "@/components/common/row-actions"
import { CardsSkeleton, ErrorState, TableSkeleton } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ROLE_LABELS } from "@/config/access"
import { api } from "@/lib/api"
import { useList, useSave } from "@/lib/crud"
import { date, kg, plural, rupees } from "@/lib/format"
import type { ApprovalGroup, ApprovalItem, ApprovalsInbox, NotificationRule } from "@/types/alerts"
import { type Decision, DecisionDialog, RuleDialog } from "./approvals-forms"
import { KINDS } from "./schemas"

const RULES = "rules"
const OLD_AFTER_DAYS = 7

/** One kind of approval: what is waiting, with the decisions its module offers. */
function ApprovalTable({ group, onDecide }: { group: ApprovalGroup; onDecide: (d: Decision) => void }) {
  const meta = KINDS[group.kind]
  const columns = useMemo<TableColumn<ApprovalItem>[]>(() => [
    { accessorKey: "number", header: "Number",
      cell: ({ row }) => (
        <Link href={row.original.href} className="font-medium underline-offset-4 hover:underline" title="Open its page">
          {row.original.number}
        </Link>
      ) },
    // The detail line is searched together with the title
    { id: "title", header: meta.what, accessorFn: (r) => `${r.title} ${r.detail}`,
      cell: ({ row }) => (
        <span className="block max-w-80">
          <span className="block truncate">{row.original.title}</span>
          {row.original.detail && <span className="block truncate text-xs text-muted-foreground" title={row.original.detail}>{row.original.detail}</span>}
        </span>
      ) },
    { id: "size", header: "Amount / weight", accessorFn: (r) => Number(r.amount ?? r.weight ?? 0), sortFn: "basic",
      cell: ({ row }) => {
        const { amount, weight } = row.original
        if (amount === null && weight === null) return <span className="text-muted-foreground">—</span>
        return (
          <span className="tabular-nums">
            {amount !== null ? rupees(amount) : kg(weight)}
            {amount !== null && weight !== null && <span className="block text-xs text-muted-foreground">{kg(weight)}</span>}
          </span>
        )
      } },
    ...(meta.who ? [{ accessorKey: "requested_by", header: meta.who,
      cell: ({ row }) => <NameWithAvatar name={row.original.requested_by} /> } satisfies TableColumn<ApprovalItem>] : []),
    { id: "date", header: "Waiting since", accessorFn: (r) => new Date(r.date), sortFn: "datetime",
      cell: ({ row }) => (
        <span>
          <span className="text-muted-foreground">{date(row.original.date)}</span>
          <span className={row.original.age_days >= OLD_AFTER_DAYS ? "block text-xs font-medium text-danger-fg" : "block text-xs text-muted-foreground"}>
            {row.original.age_days === 0 ? "today" : plural(row.original.age_days, "day")}
          </span>
        </span>
      ) },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => (
        <span className="flex justify-end gap-1.5">
          {row.original.actions.map((action, n) => (
            <Button key={action.name} size="sm" variant={n === 0 ? "default" : "outline"}
              onClick={() => onDecide({ item: row.original, action })}>
              {action.label}
            </Button>
          ))}
        </span>
      ) },
  ], [meta, onDecide])

  return (
    <DataTable columns={columns} data={group.items}
      exportName={`approvals-${group.kind.replace(/_/g, "-")}`} searchPlaceholder="Search number, name, person…"
      emptyTitle="Nothing waiting" emptyDescription={meta.empty} initialSorting={[{ id: "date", desc: false }]} />
  )
}

export function ApprovalsPage() {
  const [tab, setTab] = useState<string | null>(null)
  const [deciding, setDeciding] = useState<Decision | null>(null)
  const [editing, setEditing] = useState<NotificationRule | null>(null)

  const inbox = useQuery<ApprovalsInbox>({
    queryKey: ["alerts/approvals"], queryFn: () => api("alerts/approvals"), refetchInterval: 60_000, refetchOnWindowFocus: true,
  })
  const rules = useList<NotificationRule>("alerts/rules")
  // `mutate` is stable, so the rule columns can depend on it
  const { mutate: saveRule } = useSave<NotificationRule>("alerts/rules", { noun: "Rule", invalidate: [["alerts/notifications"]] })

  const ruleColumns = useMemo<TableColumn<NotificationRule>[]>(() => [
    { accessorKey: "title", header: "Rule",
      cell: ({ row }) => (
        <span className="block max-w-96">
          <span className="block truncate font-medium">{row.original.title}</span>
          <span className="block truncate text-xs text-muted-foreground" title={row.original.description}>{row.original.description}</span>
        </span>
      ) },
    { id: "is_enabled", header: "Status", accessorFn: (r) => (r.is_enabled ? "On" : "Off"),
      cell: ({ row }) => <StatusBadge status={row.original.is_enabled ? "On" : "Off"} tone={row.original.is_enabled ? "success" : "neutral"} /> },
    { id: "threshold", header: "Threshold", accessorFn: (r) => (r.threshold === null ? "" : `${Number(r.threshold)} ${r.threshold_label}`),
      cell: ({ row }) => row.original.threshold === null ? <span className="text-muted-foreground">—</span> : (
        <span>
          <span className="font-medium tabular-nums">{Number(row.original.threshold).toLocaleString("en-PK")}</span>
          <span className="block max-w-56 truncate text-xs text-muted-foreground" title={row.original.threshold_label}>{row.original.threshold_label}</span>
        </span>
      ) },
    { id: "roles", header: "Sent to", accessorFn: (r) => ["Admin", ...r.roles.map((role) => ROLE_LABELS[role])].join(", "),
      cell: ({ getValue }) => <span className="block max-w-64 truncate" title={getValue<string>()}>{getValue<string>()}</span> },
    { id: "send_email", header: "E-mail", accessorFn: (r) => (r.send_email ? "Yes" : "No"),
      cell: ({ row }) => row.original.send_email ? <StatusBadge status="Yes" tone="info" /> : <span className="text-muted-foreground">No</span> },
    { id: "escalate", header: "Escalates", accessorFn: (r) => r.escalate_after_days ?? -1, sortFn: "basic",
      cell: ({ row }) => row.original.escalate_after_days === null
        ? <span className="text-muted-foreground">Never</span>
        : <span>after {plural(row.original.escalate_after_days, "day")}</span> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false,
      cell: ({ row }) => {
        const rule = row.original
        return <RowActions onEdit={() => setEditing(rule)} extra={[rule.is_enabled
          ? { label: "Switch off", icon: <PowerOff className="size-4" />, onSelect: () => saveRule({ id: rule.id, body: { is_enabled: false } }) }
          : { label: "Switch on", icon: <Power className="size-4" />, onSelect: () => saveRule({ id: rule.id, body: { is_enabled: true } }) }]} />
      } },
  ], [saveRule])

  const data = inbox.data
  const groups = data?.groups ?? []
  const current = tab ?? groups.find((g) => g.count > 0)?.kind ?? groups[0]?.kind ?? RULES
  const old = groups.reduce((n, g) => n + g.items.filter((i) => i.age_days >= OLD_AFTER_DAYS).length, 0)
  const busy = groups.filter((g) => g.count > 0).length
  const rulesOn = (rules.data ?? []).filter((r) => r.is_enabled).length

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Approvals" icon="approvals"
        description="Everything waiting for your decision, and the rules behind the notification bell." />

      {inbox.isError ? (
        <ErrorState message={inbox.error.message} onRetry={() => inbox.refetch()} />
      ) : !data ? (
        <div className="space-y-6"><CardsSkeleton /><TableSkeleton columns={6} /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Waiting for a decision" icon={Inbox} tone={data.total ? "warning" : "success"} value={data.total}
              hint={data.total ? `In ${plural(busy, "list")}` : "Nothing is waiting"} muted={data.total === 0} />
            <StatCard label="Oldest item" icon={Hourglass} tone={(data.oldest_days ?? 0) >= OLD_AFTER_DAYS ? "danger" : "info"}
              value={data.oldest_days === null ? "—" : data.oldest_days === 0 ? "Today" : plural(data.oldest_days, "day")}
              hint={data.oldest_days === null ? "Nothing is waiting" : "Time it has been waiting"} muted={data.oldest_days === null} />
            <StatCard label="Waiting over a week" icon={CalendarClock} tone={old ? "danger" : "success"} value={old}
              hint={old ? "Decide these first" : "Nothing is that old"} muted={old === 0} />
            <StatCard label="Notification rules on" icon={BellRing} tone="info" value={rules.data ? rulesOn : "—"}
              hint={rules.data ? `of ${plural(rules.data.length, "rule")}` : undefined} />
          </div>

          <Tabs value={current} onValueChange={setTab}>
            <TabsList className="flex-wrap">
              {groups.map((g) => (
                <TabsTrigger key={g.kind} value={g.kind}>
                  {g.label}
                  <span className={g.count ? "ml-1.5 rounded-full bg-warning/15 px-1.5 text-xs font-semibold text-warning-fg tabular-nums" : "ml-1.5 text-xs text-faint tabular-nums"}>
                    {g.count}
                  </span>
                </TabsTrigger>
              ))}
              <TabsTrigger value={RULES}><Layers className="size-3.5" /> Rules</TabsTrigger>
            </TabsList>

            {groups.map((g) => (
              <TabsContent key={g.kind} value={g.kind} className="mt-4">
                <ApprovalTable group={g} onDecide={setDeciding} />
              </TabsContent>
            ))}

            <TabsContent value={RULES} className="mt-4">
              {rules.isError ? <ErrorState message={rules.error.message} onRetry={() => rules.refetch()} />
                : rules.isPending ? <TableSkeleton columns={7} /> : (
                  <DataTable columns={ruleColumns} data={rules.data} exportName="notification-rules" pageSize={25}
                    searchPlaceholder="Search rule, role…" emptyTitle="No notification rules"
                    emptyDescription="The rules are created when the system is set up." />
                )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      <DecisionDialog decision={deciding} onOpenChange={(o) => !o && setDeciding(null)} />
      <RuleDialog rule={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </div>
  )
}
