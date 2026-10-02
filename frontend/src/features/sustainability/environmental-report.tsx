"use client"

// The environmental report: material balance, waste, utilities and chemicals for one period.
import { useQuery } from "@tanstack/react-query"
import { Download, PackageOpen, Recycle, Scale, TrendingDown } from "lucide-react"
import { useState } from "react"

import { DateFilter, type DateFilterValue, dateParams, periodLabel } from "@/components/common/date-filter"
import { SectionTitle } from "@/components/common/section-title"
import { StatCard } from "@/components/common/stat-card"
import { CardsSkeleton, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { kg, plural, rupees } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { SustainabilityReport, WasteShare } from "@/types/sustainability"
import { CLASSIFICATION_LABELS } from "./schemas"

const n = (v: string | number | null | undefined) => Number(v) || 0
export const amount = (v: string | number | null | undefined) => n(v).toLocaleString("en-PK", { maximumFractionDigits: 2 })
export const pct = (v: string | null | undefined) => (v == null ? "—" : `${Number(v).toFixed(1)}%`)

/** "All time" has to be said out loud: with no period the summary shows this month. */
export function periodParams(period: DateFilterValue): Record<string, string | undefined> {
  return period.type === "all" ? { date_filter: "all" } : dateParams(period)
}

type Cell = string | number | null

/** A small read-only table; the first column is text, the others are numbers. */
function FigureTable({ head, rows, foot, empty }: { head: string[]; rows: Cell[][]; foot?: Cell[]; empty: string }) {
  if (!rows.length) return <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">{empty}</p>
  const align = (i: number) => (i === 0 ? "text-left" : "text-right")
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:whitespace-nowrap">
            {head.map((h, i) => <th key={h} className={align(i)}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row) => (
            <tr key={String(row[0])} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2 [&>td]:whitespace-nowrap">
              {row.map((cell, i) => <td key={head[i]} className={cn(align(i), i === 0 && "font-medium")}>{cell ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot className="tabular-nums">
            <tr className="border-t bg-muted/40 font-medium [&>td]:px-3 [&>td]:py-2 [&>td]:whitespace-nowrap">
              {foot.map((cell, i) => <td key={head[i]} className={align(i)}>{cell ?? ""}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

const shareRows = (shares: WasteShare[], label: (name: string) => string = (name) => name): Cell[][] =>
  shares.map((s) => [label(s.name), kg(s.kg), pct(s.share_pct)])

function csvRows(r: SustainabilityReport, period: string): Cell[][] {
  const blank: Cell[] = []
  return [
    ["Environmental report", period], blank,
    ["Material balance"],
    ["Material received (kg)", r.material_in.kg], ["Deliveries", r.material_in.deliveries],
    ["Taken into sorting (kg)", r.recovery.input_kg], ["Dried output (kg)", r.recovery.output_kg],
    ["Recovery rate %", r.recovery.rate_pct], ["Stage yields combined %", r.recovery.stage_yield_pct], blank,
    ["Stage", "Sessions", "Input kg", "Output kg", "Loss kg", "Loss %", "Recorded waste kg", "Other loss kg"],
    ...r.stages.map((s) => [s.stage, s.sessions, s.input_kg, s.output_kg, s.loss_kg, s.loss_pct, s.waste_kg, s.other_loss_kg]), blank,
    ["Waste handled"],
    ["Total (kg)", r.waste.total_kg], ["To landfill (kg)", r.waste.landfill_kg], ["Diverted from landfill %", r.waste.diverted_pct],
    ["Hazardous (kg)", r.waste.hazardous_kg], ["Disposal cost (Rs.)", r.waste.disposal_cost], ["Sold for (Rs.)", r.waste.revenue], blank,
    ["Classification", "kg", "Share %"],
    ...r.waste.by_classification.map((s) => [CLASSIFICATION_LABELS[s.name as keyof typeof CLASSIFICATION_LABELS] ?? s.name, s.kg, s.share_pct]), blank,
    ["Disposal method", "kg", "Share %"], ...r.waste.by_method.map((s) => [s.name, s.kg, s.share_pct]), blank,
    ["Source stage", "kg", "Share %"], ...r.waste.by_stage.map((s) => [s.name, s.kg, s.share_pct]), blank,
    ["Utilities"],
    ["Utility", "Quantity", "Unit", "Readings", "Cost (Rs.)"],
    ...r.utilities.by_utility.map((u) => [u.utility, u.quantity, u.unit, u.readings, u.cost]),
    ["Water per kg of output (litres)", r.utilities.water_l_per_kg], ["Energy per kg of output (kWh)", r.utilities.energy_kwh_per_kg],
    ["Water recorded on decolorization sessions (litres)", r.utilities.session_water_liters], blank,
    ["Chemicals"],
    ["Chemical", "Quantity", "Unit", "Issuances", "Cost (Rs.)"],
    ...r.chemicals.items.map((c) => [c.chemical_name, c.quantity, c.unit, c.issuances, c.cost]),
    ["Total chemical cost (Rs.)", r.chemicals.total_cost], ["Chemical cost per kg of output (Rs.)", r.chemicals.cost_per_kg], blank,
    ["How these are calculated"], ...r.definitions.map((d) => [d.name, d.text]),
  ]
}

function download(rows: Cell[][]) {
  const cell = (v: Cell) => {
    const text = String(v ?? "")
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const url = URL.createObjectURL(new Blob([rows.map((row) => row.map(cell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `environmental-report-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function EnvironmentalReport() {
  const [period, setPeriod] = useState<DateFilterValue>({ type: "this_month" })
  const params = periodParams(period)
  const report = useQuery<SustainabilityReport>({
    queryKey: ["sustainability/report", params], queryFn: () => api("sustainability/report", { params }),
  })
  const r = report.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <DateFilter value={period} onChange={setPeriod} />
        <Button variant="outline" className="h-9" disabled={!r} onClick={() => r && download(csvRows(r, periodLabel(period)))}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {report.isError ? <ErrorState message={report.error.message} onRetry={() => report.refetch()} />
        : !r ? <CardsSkeleton />
        : (
          <>
            <section className="space-y-4">
              <SectionTitle>Material balance</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Material received" icon={PackageOpen} tone="warehouse" value={kg(r.material_in.kg)}
                  hint={plural(r.material_in.deliveries, "delivery", "deliveries")} muted={!n(r.material_in.kg)} />
                <StatCard label="Dried output" icon={Scale} tone="drying" value={kg(r.recovery.output_kg)}
                  hint={`${kg(r.recovery.input_kg)} taken into sorting`} muted={!n(r.recovery.output_kg)} />
                <StatCard label="Recovery rate" icon={Recycle} tone="sustainability" value={pct(r.recovery.rate_pct)}
                  hint={r.recovery.stage_yield_pct == null ? "Needs completed sessions" : `Stage yields combined: ${pct(r.recovery.stage_yield_pct)}`}
                  muted={r.recovery.rate_pct == null} />
                <StatCard label="Process loss, all stages" icon={TrendingDown} tone="warning"
                  value={kg(r.stages.reduce((sum, s) => sum + n(s.loss_kg), 0))}
                  hint={`${kg(r.stages.reduce((sum, s) => sum + n(s.waste_kg), 0))} recorded as waste on sessions`}
                  muted={!r.stages.some((s) => s.sessions)} />
              </div>
              <FigureTable empty="" head={["Stage", "Sessions", "Input", "Output", "Loss", "Loss %", "Recorded waste", "Other loss"]}
                rows={r.stages.map((s) => [s.stage, s.sessions, kg(s.input_kg), kg(s.output_kg), kg(s.loss_kg), pct(s.loss_pct), kg(s.waste_kg), kg(s.other_loss_kg)])} />
              <Note>Sessions count in the period they were completed. Other loss is moisture, dust and weighing differences.</Note>
            </section>

            <section className="space-y-4">
              <SectionTitle>Waste handled</SectionTitle>
              <Note>
                {plural(r.waste.records, "record")}, {kg(r.waste.total_kg)} in total. Diverted from landfill: <span className="font-medium text-foreground">{pct(r.waste.diverted_pct)}</span>.
                {" "}Hazardous: {kg(r.waste.hazardous_kg)}. Disposal cost {rupees(r.waste.disposal_cost)}, sold for {rupees(r.waste.revenue)}.
              </Note>
              <div className="grid gap-4 lg:grid-cols-2">
                <FigureTable empty="No waste was recorded in this period." head={["Classification", "Weight", "Share"]}
                  rows={shareRows(r.waste.by_classification, (name) => CLASSIFICATION_LABELS[name as keyof typeof CLASSIFICATION_LABELS] ?? name)}
                  foot={["Total", kg(r.waste.total_kg), ""]} />
                <FigureTable empty="No waste was recorded in this period." head={["Disposal method", "Weight", "Share"]}
                  rows={shareRows(r.waste.by_method)} foot={["Total", kg(r.waste.total_kg), ""]} />
              </div>
              {r.waste.by_stage.length > 0 && (
                <FigureTable empty="" head={["Source stage", "Weight", "Share"]} rows={shareRows(r.waste.by_stage)} />
              )}
            </section>

            <section className="space-y-4">
              <SectionTitle>Utilities</SectionTitle>
              <FigureTable empty="No utility readings in this period." head={["Utility", "Used", "Readings", "Cost"]}
                rows={r.utilities.by_utility.map((u) => [u.utility, `${amount(u.quantity)} ${u.unit}`, u.readings, rupees(u.cost)])}
                foot={["Total", "", "", rupees(r.utilities.total_cost)]} />
              <Note>
                Water per kg of output: <span className="font-medium text-foreground">{r.utilities.water_l_per_kg == null ? "—" : `${amount(r.utilities.water_l_per_kg)} L`}</span>.
                {" "}Energy per kg of output: <span className="font-medium text-foreground">{r.utilities.energy_kwh_per_kg == null ? "—" : `${amount(r.utilities.energy_kwh_per_kg)} kWh`}</span>.
                {" "}Water written on decolorization sessions: {amount(r.utilities.session_water_liters)} L.
              </Note>
            </section>

            <section className="space-y-4">
              <SectionTitle>Chemicals</SectionTitle>
              <FigureTable empty="No chemicals were issued in this period." head={["Chemical", "Issued", "Issuances", "Cost"]}
                rows={r.chemicals.items.map((c) => [c.chemical_name, `${amount(c.quantity)} ${c.unit}`, c.issuances, rupees(c.cost)])}
                foot={["Total", "", r.chemicals.issuances, rupees(r.chemicals.total_cost)]} />
              <Note>
                Chemical cost per kg of output: <span className="font-medium text-foreground">{r.chemicals.cost_per_kg == null ? "—" : `Rs. ${amount(r.chemicals.cost_per_kg)}`}</span>.
              </Note>
            </section>
          </>
        )}
    </div>
  )
}
