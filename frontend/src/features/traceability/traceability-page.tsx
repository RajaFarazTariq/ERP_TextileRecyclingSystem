"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowRight, Loader2, Printer, Route, Search, ShieldAlert } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import { PageHeader } from "@/components/common/page-header"
import { SectionTitle } from "@/components/common/section-title"
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError, api } from "@/lib/api"
import { date, kg, rupees } from "@/lib/format"
import { TONE, type StageTone } from "@/lib/tones"
import { cn } from "@/lib/utils"
import type { SearchResponse, SearchResult, Trace } from "@/types/search"
import { TraceTimeline, isRestricted } from "./trace-stages"

const MIN_SEARCH = 2
const SEARCH_DELAY = 250
// Ways to point at a lot in the address: ?lot=5, or the record that leads to it
const LOOKUPS = ["lot", "order", "stock", "production"] as const

/** Search box that finds a lot by its number, material, supplier, purchase order, sales order or invoice. */
function LotPicker({ onPick }: { onPick: (lot: number) => void }) {
  const [text, setText] = useState("")
  const typed = text.trim()
  const [term, setTerm] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setTerm(typed), SEARCH_DELAY)
    return () => clearTimeout(timer)
  }, [typed])

  const wanted = typed.length >= MIN_SEARCH
  const found = useQuery({
    queryKey: ["search", "lots", term],
    queryFn: () => api<SearchResponse>("search", { params: { q: term, scope: "lots" } }),
    enabled: wanted && term.length >= MIN_SEARCH,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
  const searching = wanted && (term !== typed || found.isFetching)
  const groups = wanted ? (found.data?.groups ?? []) : []

  const pick = (result: SearchResult) => {
    if (result.lot === null) return
    setText("")
    onPick(result.lot)
  }

  return (
    <div data-print="hide" className="mb-6">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Find a lot: number, material, supplier, order or invoice…"
          aria-label="Find a fabric lot"
          className="h-10 pl-9"
        />
        {searching && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      {wanted && (
        <div className="surface mt-2 max-w-xl overflow-hidden rounded-xl" aria-label="Matching lots">
          {groups.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{searching ? "Searching…" : "No lot matches this."}</p>
          ) : (
            groups.map((group) => (
              <div key={group.type}>
                <p className="border-b bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">{group.label}</p>
                <ul>
                  {group.results.map((result) => (
                    <li key={`${result.type}-${result.id}`} className="border-b last:border-0">
                      <button
                        type="button"
                        onClick={() => pick(result)}
                        className="flex w-full min-w-0 items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{result.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">{result.detail}</span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/** Weight in → sorted → decolorized → dried → sold, each as a share of the weight in. */
function YieldStrip({ trace }: { trace: Trace }) {
  const { summary } = trace
  const start = Number(summary.weight_in)
  const hidden = (section: unknown) => (isRestricted(section) ? "Not available for your role" : null)
  const steps: { key: string; label: string; tone: StageTone; value: string | null; missing: string }[] = [
    { key: "in", label: "Weight in", tone: "warehouse", value: summary.weight_in, missing: "" },
    { key: "sorted", label: "Sorted", tone: "sorting", value: summary.sorted, missing: hidden(trace.sorting) ?? "Not sorted yet" },
    { key: "decolorized", label: "Decolorized", tone: "decolorization", value: summary.decolorized, missing: hidden(trace.decolorization) ?? "Not decolorized yet" },
    { key: "dried", label: "Dried", tone: "drying", value: summary.dried, missing: "Not dried yet" },
    { key: "sold", label: "Sold", tone: "sales", value: summary.sold, missing: hidden(trace.sales) ?? "Not sold yet" },
  ]
  const totals: [label: string, value: string][] = [
    ["Overall yield", summary.yield_pct === null ? "—" : `${summary.yield_pct}%`],
    ["Waste", summary.waste.total === null ? "—" : kg(summary.waste.total)],
    ["Returned", summary.returned === null ? "—" : kg(summary.returned)],
    ["Recorded cost", summary.total_cost === null ? "—" : rupees(summary.total_cost)],
  ]

  return (
    <section className="surface rounded-xl p-4 print:break-inside-avoid" aria-label="Yield">
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {steps.map((step) => {
          const share = step.value !== null && start > 0 ? Math.min(100, (Number(step.value) / start) * 100) : null
          return (
            <li key={step.key} data-yield={step.key} className="min-w-0 rounded-lg border p-3">
              <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TONE[step.tone].solid)} />
                {step.label}
              </p>
              {step.value === null ? (
                <p className="mt-1.5 text-sm text-muted-foreground">{step.missing}</p>
              ) : (
                <>
                  <p className="mt-1 font-heading text-lg leading-tight font-bold tracking-tight">{kg(step.value)}</p>
                  <p className="text-xs text-muted-foreground">{share === null ? "—" : `${share.toFixed(1)}% of weight in`}</p>
                </>
              )}
              <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                <span className={cn("block h-full rounded-full", TONE[step.tone].solid)} style={{ width: `${share ?? 0}%` }} />
              </span>
            </li>
          )
        })}
      </ol>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 sm:grid-cols-4">
        {totals.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** The lot itself: what it is, how much, and whether it is held in quarantine. */
function LotCard({ trace }: { trace: Trace }) {
  const { lot, source } = trace
  if (isRestricted(lot)) return null
  const facts: [label: string, value: string][] = [
    ["Supplier", isRestricted(source) ? "—" : source.delivery.supplier],
    ["Received", isRestricted(source) ? "—" : date(source.delivery.received_at)],
    ["Lot weight", kg(lot.initial_quantity)],
    ["Still to sort", kg(lot.remaining_quantity)],
  ]
  return (
    <section className="surface rounded-xl p-4 print:break-inside-avoid" aria-label="Fabric lot">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="min-w-0 font-heading text-xl font-semibold tracking-tight break-words">
          Lot #{lot.id} · {lot.material_type}
        </h2>
        <StatusBadge status={lot.status} />
        {lot.quarantined && <StatusBadge status="Quarantined" />}
      </div>
      {lot.quarantined && (
        <p className="mt-2 flex items-center gap-2 text-sm text-danger-fg">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          Held in quarantine by inspection {lot.quarantined_by}. It can&apos;t be processed or sold until an admin releases it.
        </p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function TraceView() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const key = LOOKUPS.find((name) => params.get(name))
  const value = key ? params.get(key) : null

  const trace = useQuery({
    queryKey: ["search/trace", key, value],
    queryFn: () => api<Trace>("search/trace", { params: { [key as string]: value } }),
    enabled: !!key,
    retry: false,
  })
  const open = (lot: number) => router.push(`${pathname}?lot=${lot}`)
  const data = key ? trace.data : undefined
  const failure = trace.error instanceof ApiError ? trace.error : null

  return (
    // Printed on white paper whatever the theme on screen
    <div className="print:text-foreground print:[--border:rgb(15_23_20/0.2)] print:[--card:#ffffff] print:[--foreground:#0f1714] print:[--muted-foreground:#56645d] print:[--muted:#eef1ee]">
      <PageHeader
        title="Traceability"
        icon="traceability"
        description="Follow a fabric lot from its delivery to the customer."
        actions={
          <Button variant="outline" onClick={() => window.print()} disabled={!data} data-print="hide">
            <Printer className="size-4" /> Print
          </Button>
        }
      />
      <LotPicker onPick={open} />

      {!key ? (
        <EmptyState icon={Route} title="Pick a lot to trace"
          description="Search by lot number, material, supplier, purchase order, sales order or invoice." />
      ) : trace.isPending ? (
        <CardsSkeleton count={5} />
      ) : trace.isError || !data ? (
        failure && [400, 404].includes(failure.status) ? (
          <EmptyState icon={Route} title="Lot not found" description="No fabric lot matches this link. Search for another one above." />
        ) : failure?.status === 403 ? (
          <EmptyState icon={Route} title="Not available for your role" description={failure.message} />
        ) : (
          <ErrorState message="The trace could not be loaded." onRetry={() => trace.refetch()} />
        )
      ) : (
        <div className="space-y-5">
          {data.matches.length > 1 && (
            <div data-print="hide" className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">This delivery was split into {data.matches.length} lots:</span>
              {data.matches.map((match) => (
                <Button key={match.id} size="sm" variant={match.id === data.lot_id ? "secondary" : "outline"} onClick={() => open(match.id)}>
                  Lot #{match.id} · {match.material_type}
                </Button>
              ))}
            </div>
          )}
          <LotCard trace={data} />
          <SectionTitle>Yield</SectionTitle>
          <YieldStrip trace={data} />
          <SectionTitle>From delivery to customer</SectionTitle>
          <TraceTimeline trace={data} />
          <p className="hidden text-xs text-muted-foreground print:block">Printed {date(data.summary.generated_at)}</p>
        </div>
      )}
    </div>
  )
}

export function TraceabilityPage() {
  // useSearchParams needs a Suspense boundary above it
  return (
    <Suspense fallback={<CardsSkeleton count={5} />}>
      <TraceView />
    </Suspense>
  )
}
