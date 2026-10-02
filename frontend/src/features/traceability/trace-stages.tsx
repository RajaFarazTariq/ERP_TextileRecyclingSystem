"use client"

import { Boxes, Lock } from "lucide-react"

import { StatusBadge } from "@/components/common/status-badge"
import { NavIcon } from "@/components/layout/nav-icon"
import type { NavIcon as NavIconName } from "@/config/access"
import { date, displayName, kg, rupees } from "@/lib/format"
import { TONE, type Tone } from "@/lib/tones"
import { cn } from "@/lib/utils"
import type { Restricted, Trace, TraceInspection } from "@/types/search"

export function isRestricted(value: unknown): value is Restricted {
  return typeof value === "object" && value !== null && "restricted" in value
}

const DASH = "—"
const person = (username: string | null) => (username ? displayName(username) : DASH)
const minutes = (value: number | null) => (value === null ? DASH : `${value} min`)
const degrees = (value: string | null) => (value === null ? DASH : `${Number(value)} °C`)
const period = (start: string | null, end: string | null) => (end ? `${date(start)} to ${date(end)}` : date(start))

/** One step of the timeline: a coloured marker on the line and a card beside it. */
function Stage({ id, tone, icon, title, figure, restricted, empty, children }: {
  id: string
  tone: Tone
  icon: React.ReactNode
  title: string
  /** The stage's main figure, shown on the right of its heading */
  figure?: React.ReactNode
  restricted?: boolean
  /** What to say when the lot has not reached this stage */
  empty?: string | false
  children?: React.ReactNode
}) {
  return (
    <li data-stage={id} className="group/stage relative pb-5 pl-11 last:pb-0 sm:pl-14 print:break-inside-avoid">
      <span aria-hidden className="absolute top-9 bottom-0 left-4 w-px bg-border group-last/stage:hidden sm:left-5" />
      <span className={cn("absolute top-0 left-0 flex size-8 items-center justify-center rounded-lg border sm:size-10", TONE[tone].soft, TONE[tone].text, TONE[tone].border)}>
        {icon}
      </span>
      <section className="surface min-w-0 overflow-hidden rounded-xl">
        <span aria-hidden className={cn("block h-0.5 opacity-80", TONE[tone].solid)} />
        <div className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="font-heading text-base font-semibold tracking-tight">{title}</h3>
            {!restricted && !empty && figure && <p className={cn("text-sm font-semibold", TONE[tone].text)}>{figure}</p>}
          </div>
          {restricted ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4 shrink-0" aria-hidden /> Not available for your role
            </p>
          ) : empty ? (
            <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
          ) : (
            <div className="mt-3 space-y-3">{children}</div>
          )}
        </div>
      </section>
    </li>
  )
}

/** Label and value pairs; two across on a phone, four on wider screens. */
function Facts({ items }: { items: [label: string, value: React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium break-words">{value || DASH}</dd>
        </div>
      ))}
    </dl>
  )
}

/** One record inside a stage (a session, an order, an inspection). */
function Entry({ title, status, when, children }: {
  title: React.ReactNode
  status?: React.ReactNode
  when?: string
  children?: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded-lg border p-3 print:break-inside-avoid">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 text-sm font-semibold break-words">{title}</p>
        {status}
        {when && <p className="text-xs text-muted-foreground sm:ml-auto">{when}</p>}
      </div>
      {children}
    </div>
  )
}

function Lines({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{heading}</p>
      <ul className="divide-y text-sm">{children}</ul>
    </div>
  )
}

/** A line of a list inside an entry: what it is on the left, its figures on the right. */
function Line({ children, figures }: { children: React.ReactNode; figures: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-1.5">
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 break-words">{children}</span>
      <span className="text-muted-foreground">{figures}</span>
    </li>
  )
}

function InspectionEntry({ inspection }: { inspection: TraceInspection }) {
  return (
    <Entry
      title={`${inspection.number} · ${inspection.stage}`}
      status={<><StatusBadge status={inspection.result} />{inspection.quarantined && <StatusBadge status="Quarantined" />}</>}
      when={date(inspection.inspected_on)}
    >
      <Facts items={[
        ["Inspector", person(inspection.inspector)],
        ["Composition", inspection.composition],
        ["Why it failed", inspection.rejection_reason],
        ["Released", inspection.released_at ? `${date(inspection.released_at)} by ${person(inspection.released_by)}` : ""],
      ]} />
      {inspection.actions.length > 0 && (
        <Lines heading="Corrective actions">
          {inspection.actions.map((action) => (
            <Line key={action.id} figures={action.due_date ? `due ${date(action.due_date)}` : person(action.owner)}>
              {action.description} <StatusBadge status={action.status} />
            </Line>
          ))}
        </Lines>
      )}
    </Entry>
  )
}

const stageIcon = (name: NavIconName) => <NavIcon name={name} className="size-4 sm:size-5" />

/** The lot's history as a vertical timeline, from the delivery to the customer. */
export function TraceTimeline({ trace }: { trace: Trace }) {
  const { source, sorting, decolorization, drying, production, quality, stock, sales } = trace
  const incoming = !isRestricted(source) && !isRestricted(source.inspections) ? source.inspections : []

  return (
    <ol aria-label="Lot history">
      <Stage id="delivery" tone="warehouse" icon={stageIcon("warehouse")} title="Delivery" restricted={isRestricted(source)}
        figure={!isRestricted(source) && kg(source.delivery.our_weight)}>
        {!isRestricted(source) && (
          <>
            <Facts items={[
              ["Supplier", source.delivery.supplier],
              ["Received", date(source.delivery.received_at)],
              ["Delivery", `#${source.delivery.id} · ${source.delivery.fabric_type}`],
              ["Status", <StatusBadge key="s" status={source.delivery.status} />],
              ["Our weight", kg(source.delivery.our_weight)],
              ["Unloading weight", kg(source.delivery.unloading_weight)],
              ["Vehicle", source.delivery.vehicle_no],
              ["Weight slip", source.delivery.vendor_weight_slip],
              ["Factory unit", source.delivery.unit],
              ["Purchase order", isRestricted(source.purchase_order)
                ? "Not available for your role"
                : source.purchase_order
                  ? `${source.purchase_order.number} · ${source.purchase_order.status}`
                  : "Not linked"],
              ...(!isRestricted(source.purchase_order) && source.purchase_order
                ? [["Ordered", `${kg(source.purchase_order.quantity_kg)} of ${source.purchase_order.material}`],
                   ["Price", `${rupees(source.purchase_order.unit_price)} per kg`]] as [string, string][]
                : []),
            ]} />
            {incoming.map((inspection) => <InspectionEntry key={inspection.id} inspection={inspection} />)}
          </>
        )}
      </Stage>

      <Stage id="sorting" tone="sorting" icon={stageIcon("sorting")} title="Sorting" restricted={isRestricted(sorting)}
        empty={!isRestricted(sorting) && sorting.sessions.length === 0 && "Not sorted yet."}
        figure={!isRestricted(sorting) && `${kg(sorting.sorted)} sorted`}>
        {!isRestricted(sorting) && (
          <>
            <Facts items={[["Taken", kg(sorting.taken)], ["Sorted", kg(sorting.sorted)], ["Waste", kg(sorting.waste)]]} />
            {sorting.sessions.map((s) => (
              <Entry key={s.id} title={`Session #${s.id} · ${s.unit}`} status={<StatusBadge status={s.status} />}
                when={period(s.start_date, s.end_date)}>
                <Facts items={[
                  ["Supervisor", person(s.supervisor)],
                  ["Taken", kg(s.quantity_taken)],
                  ["Sorted", kg(s.quantity_sorted)],
                  ["Waste", kg(s.waste_quantity)],
                ]} />
              </Entry>
            ))}
          </>
        )}
      </Stage>

      <Stage id="decolorization" tone="decolorization" icon={stageIcon("decolorization")} title="Decolorization"
        restricted={isRestricted(decolorization)}
        empty={!isRestricted(decolorization) && decolorization.sessions.length === 0 && "Not decolorized yet."}
        figure={!isRestricted(decolorization) && `${kg(decolorization.output)} out`}>
        {!isRestricted(decolorization) && (
          <>
            <Facts items={[
              ["Input", kg(decolorization.input)],
              ["Output", kg(decolorization.output)],
              ["Waste", kg(decolorization.waste)],
              ["Chemical cost", rupees(decolorization.chemical_cost)],
            ]} />
            {decolorization.sessions.map((s) => (
              <Entry key={s.id} title={`Session #${s.id} · ${s.tank} (batch ${s.batch_id})`}
                status={<StatusBadge status={s.status} />} when={period(s.start_date, s.end_date)}>
                <Facts items={[
                  ["Supervisor", person(s.supervisor)],
                  ["Recipe", s.recipe ?? "None"],
                  ["Input", kg(s.input_quantity)],
                  ["Output", kg(s.output_quantity)],
                  ["Waste", kg(s.waste_quantity)],
                  ["Temperature", degrees(s.temperature_c)],
                  ["Duration", minutes(s.duration_minutes)],
                  ["Approved", s.approved_at ? `${date(s.approved_at)} by ${person(s.approved_by)}` : "Not yet"],
                ]} />
                {s.chemicals.length > 0 && (
                  <Lines heading={`Chemicals issued · ${rupees(s.chemical_cost)}`}>
                    {s.chemicals.map((c) => (
                      <Line key={c.id} figures={rupees(c.cost)}>{c.chemical} · {Number(c.quantity)} {c.unit}</Line>
                    ))}
                  </Lines>
                )}
              </Entry>
            ))}
          </>
        )}
      </Stage>

      <Stage id="drying" tone="drying" icon={stageIcon("drying")} title="Drying" restricted={isRestricted(drying)}
        empty={!isRestricted(drying) && drying.sessions.length === 0 && "Not dried yet."}
        figure={!isRestricted(drying) && `${kg(drying.output)} dried`}>
        {!isRestricted(drying) && (
          <>
            <Facts items={[["Input", kg(drying.input)], ["Output", kg(drying.output)], ["Waste", kg(drying.waste)]]} />
            {drying.sessions.map((s) => (
              <Entry key={s.id} title={`Session #${s.id} · ${s.dryer}`} status={<StatusBadge status={s.status} />}
                when={period(s.start_date, s.end_date)}>
                <Facts items={[
                  ["Supervisor", person(s.supervisor)],
                  ["Input", kg(s.input_quantity)],
                  ["Output", kg(s.output_quantity)],
                  ["Waste", kg(s.waste_quantity)],
                  ["Temperature", degrees(s.temperature_celsius)],
                  ["Duration", minutes(s.duration_minutes)],
                ]} />
              </Entry>
            ))}
          </>
        )}
      </Stage>

      <Stage id="production" tone="production" icon={stageIcon("production")} title="Production orders"
        restricted={isRestricted(production)}
        empty={!isRestricted(production) && production.orders.length === 0 && "No production order for this lot."}
        figure={!isRestricted(production) && `${rupees(production.total_cost)} recorded cost`}>
        {!isRestricted(production) && production.orders.map((order) => (
          <Entry key={order.id} title={`${order.number} · ${order.product_name}`} status={<StatusBadge status={order.status} />}
            when={period(order.planned_start, order.planned_end)}>
            <Facts items={[
              ["Planned input", kg(order.planned_input_kg)],
              ["Planned output", kg(order.planned_output_kg)],
              ["Output", order.output_kg === null ? "Not yet" : kg(order.output_kg)],
              ["Waste", kg(order.waste_kg)],
              ["Yield", order.yield_pct === null ? "" : `${order.yield_pct}%`],
              ["Labour cost", rupees(order.labour_cost)],
              ["Material cost", rupees(order.material_cost)],
              ["Total cost", rupees(order.total_cost)],
            ]} />
            {order.steps.length > 0 && (
              <Lines heading="Stages">
                {order.steps.map((step) => (
                  <Line key={step.id}
                    figures={step.output_kg === null ? "" : `${kg(step.input_kg)} in · ${kg(step.output_kg)} out · ${kg(step.waste_kg)} waste`}>
                    {step.stage} <StatusBadge status={step.status} />
                  </Line>
                ))}
              </Lines>
            )}
          </Entry>
        ))}
      </Stage>

      <Stage id="quality" tone="quality" icon={stageIcon("quality")} title="Quality inspections" restricted={isRestricted(quality)}
        empty={!isRestricted(quality) && quality.inspections.length === 0 && "No in-process or finished inspection on this lot."}
        figure={!isRestricted(quality) && `${quality.inspections.length} recorded`}>
        {!isRestricted(quality) && quality.inspections.map((inspection) => (
          <InspectionEntry key={inspection.id} inspection={inspection} />
        ))}
      </Stage>

      <Stage id="stock" tone="brand" icon={<Boxes className="size-4 sm:size-5" aria-hidden />} title="Sellable stock"
        restricted={isRestricted(stock)}
        empty={!isRestricted(stock) && stock.movements.length === 0 && "Nothing has entered sellable stock yet."}
        figure={!isRestricted(stock) && `${kg(stock.available)} available`}>
        {!isRestricted(stock) && (
          <>
            <Facts items={[["On hand", kg(stock.on_hand)], ["Reserved", kg(stock.reserved)], ["Available", kg(stock.available)]]} />
            <Lines heading="Stock movements">
              {stock.movements.map((m) => (
                <Line key={m.id} figures={date(m.created_at)}>
                  <span className={cn("font-medium", Number(m.quantity) < 0 ? "text-danger-fg" : "text-success-fg")}>
                    {Number(m.quantity) > 0 ? "+" : ""}{kg(m.quantity)}
                  </span>
                  {m.label}{m.note ? ` · ${m.note}` : ""}
                </Line>
              ))}
            </Lines>
          </>
        )}
      </Stage>

      <Stage id="sales" tone="sales" icon={stageIcon("sales")} title="Sales" restricted={isRestricted(sales)}
        empty={!isRestricted(sales) && sales.orders.length === 0 && "Not sold yet."}
        figure={!isRestricted(sales) && `${kg(sales.sold)} sold`}>
        {!isRestricted(sales) && (
          <>
            <Facts items={[
              ["Sold", kg(sales.sold)],
              ["Dispatched", kg(sales.dispatched)],
              ["Returned", kg(sales.returned)],
              ["Order value", rupees(sales.revenue)],
            ]} />
            {sales.orders.map((order) => (
              <Entry key={order.id} title={`Order #${order.id} · ${order.customer}`}
                status={<><StatusBadge status={order.status} /><StatusBadge status={order.payment_status} /></>}
                when={date(order.created_at)}>
                <Facts items={[
                  ["Weight", kg(order.weight_sold)],
                  ["Price", `${rupees(order.price_per_kg)} per kg`],
                  ["Total", rupees(order.total_price)],
                  ["Quality", order.fabric_quality],
                ]} />
                {order.dispatches.length > 0 && (
                  <Lines heading="Dispatches">
                    {order.dispatches.map((d) => (
                      <Line key={d.id} figures={`${kg(d.dispatched_weight)} · ${date(d.dispatch_date)}`}>
                        {d.challan_number} · {d.vehicle_number} <StatusBadge status={d.status} />
                      </Line>
                    ))}
                  </Lines>
                )}
                {order.invoices.length > 0 && (
                  <Lines heading="Invoices">
                    {order.invoices.map((i) => (
                      <Line key={i.id} figures={`${rupees(i.total)} · ${date(i.invoice_date)}`}>
                        {i.number} <StatusBadge status={i.status} />
                      </Line>
                    ))}
                  </Lines>
                )}
                {order.returns.length > 0 && (
                  <Lines heading="Returns">
                    {order.returns.map((r) => (
                      <Line key={r.id} figures={`${kg(r.weight)} · ${date(r.return_date)}`}>
                        {r.number} · {r.restock ? "restocked" : "written off"} <StatusBadge status={r.status} />
                      </Line>
                    ))}
                  </Lines>
                )}
              </Entry>
            ))}
          </>
        )}
      </Stage>
    </ol>
  )
}
