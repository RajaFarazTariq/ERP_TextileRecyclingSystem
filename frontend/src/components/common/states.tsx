import { AlertTriangle, Inbox, RotateCw, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export function EmptyState({ title, description, action, icon: Icon = Inbox }: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <span className="relative mb-1 flex size-14 items-center justify-center rounded-2xl border bg-muted/60">
        <span className="absolute inset-0 rounded-2xl bg-brand/10 blur-xl" aria-hidden />
        <Icon className="relative size-6 text-brand-text" aria-hidden />
      </span>
      <p className="font-heading font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/30 bg-danger/5 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-danger/12">
        <AlertTriangle className="size-6 text-danger-fg" aria-hidden />
      </span>
      <p className="max-w-md text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="size-4" /> Try again
        </Button>
      )}
    </div>
  )
}

/** Placeholder with the same shape as a table (toolbar, header, rows), so nothing jumps when data arrives. */
export function TableSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="surface overflow-hidden rounded-xl">
        <div className="flex gap-4 border-b px-4 py-3.5">
          {Array.from({ length: columns }).map((_, c) => <Skeleton key={c} className="h-3 flex-1" />)}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex h-13 items-center gap-4 border-b px-4 last:border-0">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" style={{ opacity: 1 - r * 0.1 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Placeholder for a row of KPI cards. */
export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface space-y-3 rounded-xl p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}
