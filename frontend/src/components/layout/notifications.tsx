"use client"

import { AlertTriangle, Bell, Check, CheckCheck, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useSyncExternalStore } from "react"

import { ProgressBar } from "@/components/common/meters"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAttention } from "@/features/dashboard/use-attention"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"
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

/**
 * Bell in the header listing the same items as the dashboard's "Needs
 * attention". Marking an item as read only quiets the bell: the problem stays
 * listed (dimmed) until it is solved, and a problem that comes back is new again.
 */
export function Notifications({ role, username }: { role: Role; username: string }) {
  const { items } = useAttention(role)
  const { ids: readIds, save } = useReadIds(username)
  const unread = items.filter((i) => !readIds.has(i.id))
  const critical = unread.some((i) => i.severity === "critical")
  // Only ids of problems that still exist are kept, so the list can't grow forever
  const markRead = (ids: string[]) => save(items.map((i) => i.id).filter((id) => readIds.has(id) || ids.includes(id)))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-9" aria-label={unread.length ? `Notifications (${unread.length} unread)` : "Notifications"}>
          <Bell className="size-[18px]" />
          {unread.length > 0 && (
            <span className={cn(
              "absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-background",
              critical ? "bg-danger" : "bg-warning",
            )}>
              {unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <div>
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
        <div className="scrollbar-thin max-h-96 overflow-y-auto p-2">
          {items.length ? items.map((i) => {
            const isRead = readIds.has(i.id)
            return (
              <div key={i.id} className="group flex items-start gap-1 rounded-lg transition-colors hover:bg-muted">
                <Link href={i.href} onClick={() => markRead([i.id])} className={cn("flex min-w-0 flex-1 gap-3 p-2.5", isRead && "opacity-60")}>
                  <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", i.severity === "critical" ? "text-danger-fg" : "text-warning-fg")} aria-hidden />
                  <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                    <p><span className="font-medium">{i.title}</span> <span className="text-muted-foreground">{i.detail}</span></p>
                    {i.share !== undefined && (
                      <ProgressBar value={i.share} threshold={25} size="sm" tone={i.severity === "critical" ? "danger" : "warning"} label={`${i.title} stock left`} />
                    )}
                  </div>
                </Link>
                {isRead ? (
                  <span className="mt-2.5 mr-2.5 text-[11px] text-faint">Read</span>
                ) : (
                  <Button variant="ghost" size="icon-sm" className="mt-1.5 mr-1.5 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={`Mark as read: ${i.title}`} title="Mark as read" onClick={() => markRead([i.id])}>
                    <Check className="size-4" />
                  </Button>
                )}
              </div>
            )
          }) : (
            <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success-fg" aria-hidden /> All clear. Nothing needs attention.
            </p>
          )}
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
