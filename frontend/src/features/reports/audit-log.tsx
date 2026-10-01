"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, History, Search, Sun } from "lucide-react"
import { useState } from "react"

import { InitialsAvatar } from "@/components/common/identity"
import { ErrorState, TableSkeleton } from "@/components/common/states"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge, type StatusTone } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import type { AuditEntry, AuditSummary, Page } from "@/types/api"
import { ExportButton, daysAgo, today } from "./report-sections"

const ALL = "all"
const PAGE_SIZE = 25
const ACTIONS = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGIN_FAILED", "EXPORT"]
const MODELS = [
  "SalesOrder", "Payment", "DispatchTracking", "Customer", "Stock", "Vendor", "FactoryUnit", "FabricStock",
  "SortingSession", "Tank", "ChemicalStock", "ChemicalIssuance", "DecolorizationSession", "Dryer",
  "DryingSession", "StockMovement", "CustomUser",
]
const ACTION_TONES: Record<string, StatusTone> = {
  CREATE: "success", UPDATE: "info", DELETE: "danger", LOGIN: "neutral", LOGIN_FAILED: "warning", EXPORT: "neutral",
}

function describeChanges(changes: AuditEntry["changes"]): string {
  const entries = Object.entries(changes ?? {})
  if (!entries.length) return "—"
  const text = entries.slice(0, 3).map(([field, v]) => {
    if (v && typeof v === "object" && "old" in v && "new" in v) {
      const c = v as { old: unknown; new: unknown }
      return `${field}: ${String(c.old ?? "—")} → ${String(c.new ?? "—")}`
    }
    return `${field}: ${String(v)}`
  })
  return text.join("; ") + (entries.length > 3 ? ` (+${entries.length - 3} more)` : "")
}

export function AuditLog() {
  const [model, setModel] = useState(ALL)
  const [action, setAction] = useState(ALL)
  const [start, setStart] = useState(daysAgo(30))
  const [end, setEnd] = useState(today())
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const filters = {
    model: model === ALL ? undefined : model,
    action: action === ALL ? undefined : action,
    start, end,
    search: search.trim() || undefined,
  }
  const summary = useQuery<AuditSummary>({ queryKey: ["audit/logs/summary"], queryFn: () => api("audit/logs/summary") })
  const logs = useQuery<Page<AuditEntry>>({
    queryKey: ["audit/logs", filters, page],
    queryFn: () => api("audit/logs", { params: { ...filters, page, page_size: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  })
  const setFilter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }
  const pages = logs.data ? Math.max(1, Math.ceil(logs.data.count / PAGE_SIZE)) : 1

  return (
    <div className="space-y-4">
      {summary.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="All entries" icon={History} tone="running" value={summary.data.total_logs} />
          <StatCard label="Today" icon={Sun} tone="warning" value={summary.data.today} />
          <StatCard label="Last 7 days" icon={CalendarDays} tone="info" value={summary.data.this_week} />
          <StatCard label="Last 30 days" icon={CalendarRange} tone="brand" value={summary.data.this_month} />
        </div>
      )}

      <div className="surface flex flex-wrap items-end justify-between gap-3 rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={search} onChange={(e) => setFilter(setSearch)(e.target.value)} placeholder="Search user, record…" aria-label="Search audit log" className="h-9 pl-9" />
          </div>
          <Select value={model} onValueChange={setFilter(setModel)}>
            <SelectTrigger className="h-9 w-[190px]" aria-label="Record type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All record types</SelectItem>
              {MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setFilter(setAction)}>
            <SelectTrigger className="h-9 w-[160px]" aria-label="Action"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All actions</SelectItem>
              {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a.replace("_", " ").toLowerCase()}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid gap-1.5">
            <Label htmlFor="audit-start" className="text-xs text-muted-foreground">From</Label>
            <Input id="audit-start" type="date" className="h-9 w-[150px]" value={start} onChange={(e) => setFilter(setStart)(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="audit-end" className="text-xs text-muted-foreground">To</Label>
            <Input id="audit-end" type="date" className="h-9 w-[150px]" value={end} onChange={(e) => setFilter(setEnd)(e.target.value)} />
          </div>
        </div>
        <ExportButton path="audit/logs/export" params={filters} label="Export (500 rows)" />
      </div>

      {logs.isError ? <ErrorState message={logs.error.message} onRetry={() => logs.refetch()} />
        : logs.isPending ? <TableSkeleton columns={6} />
        : (
          <>
            <div className="surface overflow-hidden rounded-xl">
              <Table>
                <TableHeader className="bg-[color-mix(in_oklab,var(--card),var(--foreground)_3%)]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>When</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead>
                    <TableHead>Record</TableHead><TableHead>Changes</TableHead><TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.data.results.length ? logs.data.results.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="h-13 whitespace-nowrap text-muted-foreground">{e.timestamp_display}</TableCell>
                      <TableCell><span className="flex items-center gap-2.5"><InitialsAvatar name={e.username || "system"} /><span><span className="block font-medium">{e.username || "system"}</span>{e.user_role && <span className="block text-xs text-muted-foreground">{e.user_role}</span>}</span></span></TableCell>
                      <TableCell><StatusBadge status={e.action.replace("_", " ")} tone={ACTION_TONES[e.action] ?? "neutral"} /></TableCell>
                      <TableCell className="max-w-56"><span className="block truncate" title={e.object_repr}>{e.model_name} {e.object_id && `#${e.object_id}`}</span><span className="block truncate text-xs text-muted-foreground">{e.object_repr}</span></TableCell>
                      <TableCell className="max-w-80"><span className="line-clamp-2 text-xs wrap-anywhere text-muted-foreground" title={describeChanges(e.changes)}>{describeChanges(e.changes)}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.ip_address ?? "—"}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No entries match these filters.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
              <span>{logs.data.count.toLocaleString()} entries · page {page} of {pages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="icon-sm" disabled={!logs.data.previous || logs.isFetching} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
                <Button variant="outline" size="icon-sm" disabled={!logs.data.next || logs.isFetching} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button>
              </div>
            </div>
          </>
        )}
    </div>
  )
}
