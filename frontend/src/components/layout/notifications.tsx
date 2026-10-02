"use client"

import { AlertCircle, AlertTriangle, Bell, Check, CheckCheck, CheckCircle2, ChevronsUp, Info, RotateCw, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { useMemo, useSyncExternalStore } from "react"

import { ProgressBar } from "@/components/common/meters"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { type AttentionItem, useAttention } from "@/features/dashboard/use-attention"
import { date, plural } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { AlertSeverity } from "@/types/alerts"
import type { Role } from "@/types/api"

// Which notifications this user has marked as read, kept in this browser
const READ_KEY = "erp.notifications-read"
const CHANGED = "erp:notifications-read"

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGED, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGED, onChange)
  }
}

function useReadIds(username: string) {
  const key = `${READ_KEY}.${username}`
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? ""
      } catch {
        return ""
      }
    },
    () => "",
  )
  const ids = useMemo(() => new Set(raw ? raw.split("\n") : []), [raw])
  const save = (next: string[]) => {
    try {
      localStorage.setItem(key, next.join("\n"))
    } catch {
      // storage unavailable (private mode): nothing to remember
    }
    window.dispatchEvent(new Event(CHANGED))
  }
  return { ids, save }
}

// One look per severity: icon, its colour, the stripe on the left of the item and the badge on the bell
const LOOK: Record<AlertSeverity, { icon: LucideIcon; text: string; stripe: string; badge: string; bar: "danger" | "warning" | "info" }> = {
  danger: { icon: AlertCircle, text: "text-danger-fg", stripe: "border-l-danger", badge: "bg-danger", bar: "danger" },
  warning: { icon: AlertTriangle, text: "text-warning-fg", stripe: "border-l-warning", badge: "bg-warning", bar: "warning" },
  info: { icon: Info, text: "text-info-fg", stripe: "border-l-info", badge: "bg-info", bar: "info" },
}

// Sections of the list, most pressing first. Escalated items are pulled out of their severity.
const SECTIONS: { key: string; label: string; match: (i: AttentionItem) => boolean }[] = [
  { key: "escalated", label: "Escalated", match: (i) => i.escalated },
  { key: "danger", label: "Urgent", match: (i) => !i.escalated && i.level === "danger" },
  { key: "warning", label: "Warnings", match: (i) => !i.escalated && i.level === "warning" },
  { key: "info", label: "For information", match: (i) => !i.escalated && i.level === "info" },
]

/**
 * Bell in the header listing the same items as the dashboard's "Needs
 * attention". Marking an item as read only quiets the bell: the problem stays
 * listed (dimmed) until it is solved, and a problem that comes back is new again.
 */
export function Notifications({ role, username }: { role: Role; username: string }) {
  const { items, alerts } = useAttention(role)
  const { ids: readIds, save } = useReadIds(username)
  const unread = items.filter((i) => !readIds.has(i.id))
  const worst: AlertSeverity = unread.some((i) => i.level === "danger") ? "danger" : unread.some((i) => i.level === "warning") ? "warning" : "info"
  // Only ids of problems that still exist are kept, so the list can't grow forever
  const markRead = (ids: string[]) => save(items.map((i) => i.id).filter((id) => readIds.has(id) || ids.includes(id)))
  const sections = SECTIONS.map((s) => ({ ...s, items: items.filter(s.match) })).filter((s) => s.items.length > 0)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-9" aria-label={unread.length ? `Notifications (${unread.length} unread)` : "Notifications"}>
          <Bell className="size-[18px]" />
          {unread.length > 0 && (
            <span className={cn(
              "absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-background",
              LOOK[worst].badge,
            )}>
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold">Needs attention</p>
            <p className="text-xs text-muted-foreground">
              {items.length ? `${items.length} open · ${unread.length} unread` : "Nothing open"}
            </p>
          </div>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 shrink-0 text-brand-text" onClick={() => markRead(unread.map((i) => i.id))}>
              <CheckCheck className="size-4" /> Mark all as read
            </Button>
          )}
        </div>
        <div className="scrollbar-thin max-h-[min(26rem,calc(100dvh-11rem))] overflow-x-hidden overflow-y-auto p-2">
          {sections.map((section) => (
            <section key={section.key} aria-label={section.label}>
              <h3 className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {section.key === "escalated" && <ChevronsUp className="size-3.5 text-danger-fg" aria-hidden />}
                {section.label} <span className="font-normal text-faint">{section.items.length}</span>
              </h3>
              {section.items.map((i) => {
                const isRead = readIds.has(i.id)
                const look = LOOK[i.level]
                const Icon = look.icon
                return (
                  <div key={i.id} className={cn("group mb-1 flex items-start gap-1 rounded-lg border-l-2 transition-colors hover:bg-muted", look.stripe)}>
                    <Link href={i.href} onClick={() => markRead([i.id])} className={cn("flex min-w-0 flex-1 gap-3 p-2.5", isRead && "opacity-60")}>
                      <Icon className={cn("mt-0.5 size-4 shrink-0", look.text)} aria-hidden />
                      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                        <p className="break-words"><span className="font-medium">{i.title}</span> <span className="text-muted-foreground">{i.detail}</span></p>
                        {i.share !== undefined && (
                          <ProgressBar value={i.share} size="sm" tone={look.bar} label={`${i.title} stock left`} />
                        )}
                        {(i.escalated || i.created) && (
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
                            {i.escalated && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/12 px-1.5 py-px font-semibold text-danger-fg">
                                <ChevronsUp className="size-3" aria-hidden /> Escalated
                              </span>
                            )}
                            {i.created && <span>Since {date(i.created)}</span>}
                          </p>
                        )}
                      </div>
                    </Link>
                    {isRead ? (
                      <span className="mt-2.5 mr-2.5 shrink-0 text-[11px] text-faint">Read</span>
                    ) : (
                      <Button variant="ghost" size="icon-sm" className="mt-1.5 mr-1.5 shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={`Mark as read: ${i.title}`} title="Mark as read" onClick={() => markRead([i.id])}>
                        <Check className="size-4" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </section>
          ))}
          {!items.length && (alerts.isError ? (
            <div role="alert" className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm">
              <AlertTriangle className="size-5 text-danger-fg" aria-hidden />
              <p>Notifications could not be loaded.</p>
              <Button variant="outline" size="sm" onClick={() => alerts.refetch()}><RotateCw className="size-3.5" /> Try again</Button>
            </div>
          ) : alerts.isPending ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-3 py-7 text-center">
              <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-success/12">
                <CheckCircle2 className="size-5 text-success-fg" aria-hidden />
              </span>
              <p className="font-heading text-sm font-semibold">All clear</p>
              <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>
            </div>
          ))}
        </div>
        {items.length > 0 && unread.length === 0 && (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            All read. {plural(items.length, "item")} stay{items.length === 1 ? "s" : ""} listed until solved.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
