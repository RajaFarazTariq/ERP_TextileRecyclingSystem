"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Loader2, LogOut, Monitor, Moon, Search, Sun } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { navFor, type NavIcon as NavIconName } from "@/config/access"
import { NAV_TONES } from "@/config/nav-tones"
import { logout } from "@/features/auth/use-session"
import { api } from "@/lib/api"
import { TONE } from "@/lib/tones"
import { cn } from "@/lib/utils"
import type { SearchResponse, SearchResultType } from "@/types/search"
import { NavIcon } from "./nav-icon"

// Tabs inside each module, so "payments" or "dryers" can be found directly
const SECTIONS: Record<string, string[]> = {
  "/warehouse": ["Stock entries", "Vendors", "Factory units"],
  "/sorting": ["Sessions", "Fabric lots"],
  "/decolorization": ["Tanks", "Chemicals", "Chemical lots", "Recipes", "Issuances", "Sessions", "Chemical usage"],
  "/drying": ["Sessions", "Dryers"],
  "/procurement": ["Purchase requests", "Purchase orders", "Supplier invoices", "Supplier payments", "Purchase returns", "Suppliers", "Price comparison"],
  "/production": ["Production orders", "Schedule", "Material requirements", "Routings", "Bills of materials", "Process stages"],
  "/quality": ["Inspections", "Quarantine", "Corrective actions", "Quality standards"],
  "/sales": ["Quotations", "Orders", "Dispatches", "Invoices", "Payments", "Returns", "Customers", "Products and prices", "Sales performance"],
  "/finance": ["Chart of accounts", "Journal entries", "Expenses", "Receivables", "Payables", "Trial balance", "Profit and loss", "Balance sheet"],
  "/maintenance": ["Machines", "Work orders", "Maintenance schedules", "Breakdowns", "Spare parts", "Downtime"],
  "/sustainability": ["Waste records", "Recovery rates", "Water and energy", "Disposal records", "Environmental report"],
  "/workforce": ["Employees", "Departments", "Shifts", "Attendance", "Leave", "Tasks", "Productivity"],
  "/documents": ["Documents", "Certificates", "Safety data sheets", "Expiring documents"],
  "/reports": ["Report centre", "Daily production", "Monthly sales", "Waste analysis", "Audit log"],
  "/approvals": ["Waiting for approval", "Notification rules"],
  "/traceability": ["Trace a lot"],
}

// The module each kind of record belongs to (icon and colour)
const RESULT_ICONS: Record<SearchResultType, NavIconName> = {
  lots: "traceability",
  deliveries: "warehouse",
  suppliers: "procurement",
  customers: "sales",
  requisitions: "procurement",
  purchase_orders: "procurement",
  sales_orders: "sales",
  quotations: "sales",
  invoices: "sales",
  returns: "sales",
  production_orders: "production",
  inspections: "quality",
  chemicals: "decolorization",
  machines: "maintenance",
  work_orders: "maintenance",
  employees: "workforce",
  documents: "documents",
}

const MIN_SEARCH = 2
const SEARCH_DELAY = 250

// Every typed word must appear in the item ("pay" finds Payments, not "Drying")
function matchWords(value: string, search: string) {
  const text = value.toLowerCase()
  return search.toLowerCase().split(/\s+/).filter(Boolean).every((w) => text.includes(w)) ? 1 : 0
}

/** Records found by the server for what was typed, once typing pauses. */
function useRecordSearch(search: string) {
  const typed = search.trim()
  const [term, setTerm] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setTerm(typed), SEARCH_DELAY)
    return () => clearTimeout(timer)
  }, [typed])

  const wanted = typed.length >= MIN_SEARCH
  const query = useQuery({
    queryKey: ["search", term],
    queryFn: () => api<SearchResponse>("search", { params: { q: term } }),
    enabled: wanted && term.length >= MIN_SEARCH,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
  return {
    groups: wanted ? (query.data?.groups ?? []) : [],
    searching: wanted && (term !== typed || query.isFetching),
  }
}

/** Ctrl+K / Cmd+K palette: jump to any page or section, find a record, switch theme, sign out. */
export function CommandMenu({ pages }: { pages: string[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 w-9 justify-start gap-2 px-0 text-muted-foreground lg:w-56 lg:px-3 xl:w-72"
        aria-label="Search pages and actions"
      >
        <Search className="mx-auto size-4 lg:mx-0" />
        <span className="hidden flex-1 text-left font-normal lg:inline">Search or jump to…</span>
        <kbd className="pointer-events-none hidden h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium lg:inline-flex">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a page, find a record or run an action" className="sm:max-w-xl">
        <Palette allowed={pages} close={() => setOpen(false)} />
      </CommandDialog>
    </>
  )
}

// Lives inside the dialog, so what was typed is forgotten each time it closes
function Palette({ allowed, close }: { allowed: string[]; close: () => void }) {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [search, setSearch] = useState("")
  const { groups, searching } = useRecordSearch(search)

  const run = (action: () => void) => {
    close()
    action()
  }
  const pages = navFor(allowed).flatMap((g) => g.items)

  return (
    <Command filter={matchWords}>
      <CommandInput placeholder="Type a page, section or action…" value={search} onValueChange={setSearch} />
      <CommandList className="scrollbar-thin max-h-[min(26rem,calc(100dvh-7rem))]">
        {!searching && <CommandEmpty>Nothing found.</CommandEmpty>}
        <CommandGroup heading="Pages">
          {pages.map((p) => (
            <CommandItem key={p.href} value={`page ${p.title}`} onSelect={() => run(() => router.push(p.href))}>
              <span className={cn("flex size-6 items-center justify-center rounded-md", TONE[NAV_TONES[p.icon]].soft)}>
                <NavIcon name={p.icon} className={cn("size-3.5", TONE[NAV_TONES[p.icon]].text)} />
              </span>
              {p.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Sections">
          {pages.flatMap((p) =>
            (SECTIONS[p.href] ?? []).map((section) => (
              <CommandItem key={`${p.href}-${section}`} value={`${p.title} ${section}`} onSelect={() => run(() => router.push(p.href))}>
                <NavIcon name={p.icon} className={cn("size-4", TONE[NAV_TONES[p.icon]].text)} />
                {section}
                <CommandShortcut>{p.title}</CommandShortcut>
              </CommandItem>
            )),
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem value="theme light" onSelect={() => run(() => setTheme("light"))}><Sun /> Light theme</CommandItem>
          <CommandItem value="theme dark" onSelect={() => run(() => setTheme("dark"))}><Moon /> Dark theme</CommandItem>
          <CommandItem value="theme system" onSelect={() => run(() => setTheme("system"))}><Monitor /> Use system theme</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem value="sign out log out" onSelect={() => run(() => logout())}><LogOut /> Sign out</CommandItem>
        </CommandGroup>
        {/* Records found by the server. Each value starts with what was typed, so the word filter keeps it. */}
        {groups.map((group) => (
          <CommandGroup key={group.type} heading={group.label} data-search-group={group.type}>
            {group.results.map((result) => {
              const icon = RESULT_ICONS[result.type] ?? "traceability"
              return (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  value={`${search} ${result.label} ${result.detail} ${result.type} ${result.id}`}
                  onSelect={() => run(() => router.push(result.href))}
                >
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", TONE[NAV_TONES[icon]].soft)}>
                    <NavIcon name={icon} className={cn("size-3.5", TONE[NAV_TONES[icon]].text)} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{result.label}</span>
                    {result.detail && <span className="block truncate text-xs text-muted-foreground">{result.detail}</span>}
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
        {searching && (
          <div role="status" className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Searching records…
          </div>
        )}
      </CommandList>
    </Command>
  )
}
