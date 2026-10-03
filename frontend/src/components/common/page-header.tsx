"use client"

import { Eye } from "lucide-react"

import { NavIcon } from "@/components/layout/nav-icon"
import { Badge } from "@/components/ui/badge"
import type { NavIcon as NavIconName } from "@/config/access"
import { NAV_TONES } from "@/config/nav-tones"
import { usePageAccess } from "@/features/auth/use-page-access"
import { TONE } from "@/lib/tones"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
  icon,
  meta,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  /** Module icon, shown in its stage colour */
  icon?: NavIconName
  /** Small line under the description, e.g. "Updated 2 minutes ago" */
  meta?: React.ReactNode
}) {
  const tone = icon ? NAV_TONES[icon] : undefined
  // Held to "view": the page's add buttons go, and a badge says why
  const { readOnly } = usePageAccess()
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3.5">
        {icon && tone && (
          <span className={cn("mt-0.5 hidden size-11 shrink-0 items-center justify-center rounded-xl border sm:flex", TONE[tone].soft, TONE[tone].text, TONE[tone].border)}>
            <NavIcon name={icon} className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-heading text-[28px] leading-8 font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          {meta && <div className="mt-1.5 text-xs text-muted-foreground">{meta}</div>}
        </div>
      </div>
      {readOnly ? (
        <Badge variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" title="You can look at this page but not change anything. Ask an admin if you need more.">
          <Eye aria-hidden /> View only
        </Badge>
      ) : actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
