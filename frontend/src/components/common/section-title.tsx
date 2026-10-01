/** Small heading that groups cards on a dashboard, e.g. "Throughput". */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h2>
      <span className="h-px flex-1 bg-border" aria-hidden />
      {action}
    </div>
  )
}
