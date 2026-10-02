"use client"

// The daily attendance sheet: every current employee on one screen, saved with one button.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, CalendarCheck, Loader2, Save, Search } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { today } from "@/features/procurement/schemas"
import { ApiError, api } from "@/lib/api"
import { plural } from "@/lib/format"
import type { AttendanceSheet, AttendanceStatus, SheetRow, Shift } from "@/types/workforce"
import { ATTENDANCE_STATUSES, ATTENDANCE_TONES, hours, hoursBetween, notAtWork, shortTime } from "./schemas"
import { WORKFORCE_LISTS, shiftLabel } from "./workforce-forms"

const ALL = "all"

interface Mark {
  status: AttendanceStatus
  check_in: string
  check_out: string
}

/** What a row shows before the user touches it: the saved record, approved leave, or present for the shift's hours. */
function startingMark(row: SheetRow, shift: Shift | undefined): Mark {
  if (row.record) return { status: row.record.status, check_in: shortTime(row.record.check_in), check_out: shortTime(row.record.check_out) }
  if (row.on_leave) return { status: "Leave", check_in: "", check_out: "" }
  return { status: "Present", check_in: shortTime(shift?.start_time), check_out: shortTime(shift?.end_time) }
}

export function AttendanceSheetPanel({ shifts }: { shifts: Shift[] }) {
  const [day, setDay] = useState(today)
  const [shift, setShift] = useState(ALL)
  const sheet = useQuery<AttendanceSheet>({
    queryKey: ["workforce/attendance/sheet", day],
    queryFn: () => api("workforce/attendance/sheet", { params: { date: day } }),
    enabled: !!day,
  })

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5 text-[13px] font-medium">
          Date
          <Input type="date" className="h-9 w-[160px]" max={today()} value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <div className="grid gap-1.5 text-[13px] font-medium">
          <span id="sheet-shift-label">Shift</span>
          <Select value={shift} onValueChange={setShift}>
            <SelectTrigger className="h-9 w-[220px] max-w-full" aria-labelledby="sheet-shift-label"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All shifts</SelectItem>
              {shifts.filter((s) => s.is_active).map((s) => <SelectItem key={s.id} value={String(s.id)}>{shiftLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!day ? <EmptyState icon={CalendarCheck} title="Choose a date" />
        : sheet.isError ? <ErrorState message={sheet.error.message} onRetry={() => sheet.refetch()} />
        : !sheet.data ? <TableSkeleton columns={4} />
        // A new date starts a fresh sheet, so unsaved marks of another day can't leak into it
        : <SheetRows key={day} day={day} rows={sheet.data.rows} shifts={shifts} shiftId={shift === ALL ? null : Number(shift)} />}
    </section>
  )
}

function SheetRows({ day, rows, shifts, shiftId }: { day: string; rows: SheetRow[]; shifts: Shift[]; shiftId: number | null }) {
  const qc = useQueryClient()
  const [edits, setEdits] = useState<Record<number, Mark>>({})
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")

  const shiftOf = (row: SheetRow) => shifts.find((s) => s.id === (shiftId ?? row.shift))
  const markOf = (row: SheetRow) => edits[row.employee] ?? startingMark(row, shiftOf(row))
  // With a shift chosen: its people, people with no fixed shift, and anyone already recorded on it
  const onShift = rows.filter((r) => shiftId === null || r.shift === shiftId || r.shift === null || r.record?.shift === shiftId)
  const term = search.trim().toLowerCase()
  const shown = term ? onShift.filter((r) => `${r.full_name} ${r.number} ${r.department_name}`.toLowerCase().includes(term)) : onShift

  const change = (row: SheetRow, patch: Partial<Mark>) => {
    setError("")
    setEdits((all) => {
      const next = { ...(all[row.employee] ?? startingMark(row, shiftOf(row))), ...patch }
      if (patch.status && notAtWork(patch.status)) {
        next.check_in = ""
        next.check_out = ""
      } else if (patch.status && !next.check_in && !next.check_out) {
        // Back at work: start again from the shift's hours
        const usual = shiftOf(row)
        next.check_in = shortTime(usual?.start_time)
        next.check_out = shortTime(usual?.end_time)
      }
      return { ...all, [row.employee]: next }
    })
  }

  const save = useMutation<unknown, ApiError, void>({
    mutationFn: () => api("workforce/attendance/mark", {
      method: "POST",
      body: {
        date: day,
        shift: shiftId,
        records: onShift.map((row) => {
          const mark = markOf(row)
          const away = notAtWork(mark.status)
          return { employee: row.employee, status: mark.status, check_in: away ? null : mark.check_in || null, check_out: away ? null : mark.check_out || null }
        }),
      },
    }),
    onSuccess: () => {
      toast.success(`Attendance saved for ${plural(onShift.length, "employee")}.`)
      setEdits({})
      for (const key of WORKFORCE_LISTS) qc.invalidateQueries({ queryKey: key })
    },
    onError: (e) => setError(e.fieldErrors.records ?? e.message),
  })

  const submit = () => {
    const missing = onShift.find((row) => {
      const mark = markOf(row)
      return !notAtWork(mark.status) && mark.check_out && !mark.check_in
    })
    if (missing) return setError(`${missing.full_name}: enter the check-in time too.`)
    setError("")
    save.mutate()
  }

  if (!rows.length) {
    return <EmptyState icon={CalendarCheck} title="No employees to mark" description="Add employees first; people who have left are not listed." />
  }

  const counts = ATTENDANCE_STATUSES.map((s) => ({ status: s, count: onShift.filter((r) => markOf(r).status === s).length })).filter((c) => c.count)
  const unsaved = onShift.filter((r) => !r.record).length

  return (
    <div className="surface overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-3 sm:px-4">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee…" aria-label="Search employee" className="h-9 pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {counts.map((c) => <StatusBadge key={c.status} status={`${c.count} ${c.status.toLowerCase()}`} tone={ATTENDANCE_TONES[c.status]} />)}
        </div>
      </div>

      <div className="hidden grid-cols-[minmax(0,1fr)_9.5rem_7.5rem_7.5rem_4.5rem] gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
        <span>Employee</span><span>Status</span><span>Check-in</span><span>Check-out</span><span className="text-right">Hours</span>
      </div>
      <ul className="divide-y">
        {shown.map((row) => {
          const mark = markOf(row)
          const away = notAtWork(mark.status)
          const worked = away ? null : hoursBetween(mark.check_in, mark.check_out)
          return (
            <li key={row.employee} className="grid grid-cols-2 items-center gap-x-3 gap-y-2 px-3 py-3 sm:px-4 md:grid-cols-[minmax(0,1fr)_9.5rem_7.5rem_7.5rem_4.5rem]">
              <div className="col-span-full min-w-0 md:col-span-1">
                <p className="truncate text-sm font-medium">{row.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.number} · {row.department_name}
                  {row.on_leave ? ` · On ${row.leave_type?.toLowerCase()} leave` : !row.record ? " · Not saved yet" : ""}
                </p>
              </div>
              <Select value={mark.status} onValueChange={(v) => change(row, { status: v as AttendanceStatus })}>
                <SelectTrigger className="col-span-full h-9 w-full md:col-span-1" aria-label={`Status of ${row.full_name}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                <span className="md:sr-only">Check-in</span>
                <Input type="time" className="h-9 min-w-0" disabled={away} value={mark.check_in} aria-label={`Check-in of ${row.full_name}`}
                  onChange={(e) => change(row, { check_in: e.target.value })} />
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                <span className="md:sr-only">Check-out</span>
                <Input type="time" className="h-9 min-w-0" disabled={away} value={mark.check_out} aria-label={`Check-out of ${row.full_name}`}
                  onChange={(e) => change(row, { check_out: e.target.value })} />
              </label>
              <p className="col-span-full text-xs text-muted-foreground tabular-nums md:col-span-1 md:text-right md:text-sm">
                {worked != null ? `${hours(worked)} h` : "—"}
              </p>
            </li>
          )
        })}
        {!shown.length && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No employee matches.</li>}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-3 sm:px-4">
        <p className="min-w-0 text-sm text-muted-foreground">
          {plural(onShift.length, "employee")}{unsaved ? ` · ${unsaved} not saved yet` : " · all saved"}
          {term && shown.length !== onShift.length ? ". Saving includes the ones hidden by the search." : ""}
        </p>
        <Button onClick={submit} disabled={save.isPending || !onShift.length}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save attendance
        </Button>
        {error && (
          <p role="alert" className="flex w-full items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger-fg">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
          </p>
        )}
      </div>
    </div>
  )
}
