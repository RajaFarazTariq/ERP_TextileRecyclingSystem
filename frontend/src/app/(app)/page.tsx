import { ArrowUpRight } from "lucide-react"
import { cookies } from "next/headers"
import Link from "next/link"

import { NavIcon } from "@/components/layout/nav-icon"
import { ROLE_LABELS, type NavIcon as NavIconName, navFor } from "@/config/access"
import { NAV_TONES } from "@/config/nav-tones"
import { displayName } from "@/lib/format"
import { COOKIE, parseUserCookie } from "@/lib/server/session"
import { TONE } from "@/lib/tones"
import { cn } from "@/lib/utils"

const DESCRIPTIONS: Record<NavIconName, string> = {
  dashboard: "Material flow, stock, sales and alerts at a glance.",
  approvals: "Everything waiting for a decision, in one place.",
  traceability: "Follow a lot from delivery to the customer, and back.",
  warehouse: "Record fabric deliveries, vendors and factory units.",
  sorting: "Run sorting sessions and track fabric lots.",
  decolorization: "Tanks, chemical stock and decolorization batches.",
  drying: "Dryers and drying batches; output becomes sellable.",
  procurement: "Purchase requests, orders, supplier invoices and payments.",
  quality: "Inspections, quarantine, corrective actions and standards.",
  production: "Production orders, schedule, material needs and costs.",
  sales: "Quotations, orders, dispatches, invoices, payments and customers.",
  finance: "Accounts, journal, expenses, balances and financial reports.",
  maintenance: "Machines, maintenance schedules, work orders and downtime.",
  sustainability: "Waste, recovery rates, water, energy and chemical use.",
  workforce: "Employees, departments, shifts, attendance and leave.",
  documents: "Certificates, data sheets and other files, with versions and expiry dates.",
  reports: "Production, sales and waste reports, and the audit log.",
  users: "Accounts, roles and access.",
}

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
}

export default async function HomePage() {
  const user = parseUserCookie((await cookies()).get(COOKIE.user)?.value)!
  const groups = navFor(user.role)
  // Server time in Pakistan, where the factory runs
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Karachi" }).format(new Date()))

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <section className="surface relative animate-rise overflow-hidden rounded-2xl p-6 sm:p-8">
        <div aria-hidden className="absolute -top-24 -right-16 size-72 rounded-full bg-brand/15 blur-3xl" />
        <div aria-hidden className="absolute -bottom-28 left-1/3 size-64 rounded-full bg-brand-2/10 blur-3xl" />
        <p className="relative text-xs font-semibold tracking-widest text-brand-text uppercase">{ROLE_LABELS[user.role]}</p>
        <h1 className="relative mt-2 font-heading text-3xl font-bold tracking-tight">
          {greeting(hour)}, {displayName(user.username)}
        </h1>
        <p className="relative mt-1.5 max-w-xl text-muted-foreground">
          Pick up where the line left off. Press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">Ctrl K</kbd> to jump anywhere.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {groups.flatMap((group) => group.items.map((m) => {
          const tone = TONE[NAV_TONES[m.icon]]
          return (
            <Link
              key={m.href}
              href={m.href}
              className="surface group relative flex animate-rise flex-col overflow-hidden rounded-xl p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg hover:shadow-black/5"
            >
              <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 opacity-70", tone.solid)} />
              <div className="flex items-start justify-between">
                <span className={cn("flex size-10 items-center justify-center rounded-xl", tone.soft, tone.text)}>
                  <NavIcon name={m.icon} className="size-5" />
                </span>
                <ArrowUpRight className="size-4 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" aria-hidden />
              </div>
              <p className="mt-4 text-[11px] font-semibold tracking-wider text-faint uppercase">{group.label}</p>
              <p className="mt-0.5 font-heading font-semibold">{m.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{DESCRIPTIONS[m.icon]}</p>
            </Link>
          )
        }))}
      </div>
    </div>
  )
}
