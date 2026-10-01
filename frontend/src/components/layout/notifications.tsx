"use client"

import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react"
import Link from "next/link"

import { ProgressBar } from "@/components/common/meters"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { canAccess } from "@/config/access"
import { useAttention } from "@/features/dashboard/use-attention"
import { cn } from "@/lib/utils"
import type { Role } from "@/types/api"

/** Bell in the header listing the same items as the dashboard's "Needs attention". */
export function Notifications({ role }: { role: Role }) {
  const { items } = useAttention(role)
  if (!canAccess(role, "/decolorization") && !canAccess(role, "/sales")) return null
  const critical = items.some((i) => i.severity === "critical")

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-9" aria-label={items.length ? `Notifications (${items.length})` : "Notifications"}>
          <Bell className="size-[18px]" />
          {items.length > 0 && (
            <span className={cn(
              "absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-background",
              critical ? "bg-danger" : "bg-warning",
            )}>
              {items.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-heading text-sm font-semibold">Needs attention</p>
          <span className="text-xs text-muted-foreground">{items.length} open</span>
        </div>
        <div className="scrollbar-thin max-h-96 overflow-y-auto p-2">
          {items.length ? items.map((i) => (
            <Link key={i.id} href={i.href} className="flex gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted">
              <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", i.severity === "critical" ? "text-danger-fg" : "text-warning-fg")} aria-hidden />
              <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                <p><span className="font-medium">{i.title}</span> <span className="text-muted-foreground">{i.detail}</span></p>
                {i.share !== undefined && (
                  <ProgressBar value={i.share} threshold={25} size="sm" tone={i.severity === "critical" ? "danger" : "warning"} label={`${i.title} stock left`} />
                )}
              </div>
            </Link>
          )) : (
            <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success-fg" aria-hidden /> All clear. Nothing needs attention.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
