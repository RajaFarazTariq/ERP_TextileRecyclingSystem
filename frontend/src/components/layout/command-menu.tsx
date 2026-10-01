"use client"

import { LogOut, Monitor, Moon, Search, Sun } from "lucide-react"
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
import { navFor } from "@/config/access"
import { NAV_TONES } from "@/config/nav-tones"
import { logout } from "@/features/auth/use-session"
import { TONE } from "@/lib/tones"
import { cn } from "@/lib/utils"
import type { Role } from "@/types/api"
import { NavIcon } from "./nav-icon"

// Tabs inside each module, so "payments" or "dryers" can be found directly
const SECTIONS: Record<string, string[]> = {
  "/warehouse": ["Stock entries", "Vendors", "Factory units"],
  "/sorting": ["Sessions", "Fabric lots"],
  "/decolorization": ["Tanks", "Chemicals", "Issuances", "Sessions"],
  "/drying": ["Sessions", "Dryers"],
  "/procurement": ["Purchase requests", "Purchase orders", "Supplier invoices", "Supplier payments", "Purchase returns", "Suppliers", "Price comparison"],
  "/production": ["Production orders", "Schedule", "Material requirements", "Routings", "Bills of materials", "Process stages"],
  "/quality": ["Inspections", "Quarantine", "Corrective actions", "Quality standards"],
  "/sales": ["Orders", "Dispatches", "Payments", "Customers"],
  "/reports": ["Daily production", "Monthly sales", "Waste analysis", "Audit log"],
}

// Every typed word must appear in the item ("pay" finds Payments, not "Drying")
function matchWords(value: string, search: string) {
  const text = value.toLowerCase()
  return search.toLowerCase().split(/\s+/).filter(Boolean).every((w) => text.includes(w)) ? 1 : 0
}

/** Ctrl+K / Cmd+K palette: jump to any page or section, switch theme, sign out. */
export function CommandMenu({ role }: { role: Role }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { setTheme } = useTheme()

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

  const run = (action: () => void) => {
    setOpen(false)
    action()
  }
  const pages = navFor(role).flatMap((g) => g.items)

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
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a page or run an action" className="sm:max-w-xl">
        <Command filter={matchWords}>
          <CommandInput placeholder="Type a page, section or action…" />
          <CommandList className="scrollbar-thin max-h-[60vh]">
            <CommandEmpty>Nothing found.</CommandEmpty>
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
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
