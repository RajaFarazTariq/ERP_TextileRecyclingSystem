"use client"

import { useQuery } from "@tanstack/react-query"

import { canAccess } from "@/config/access"
import { api } from "@/lib/api"
import type { AlertItem, AlertSeverity } from "@/types/alerts"
import type { Chemical, LotStock, Role } from "@/types/api"

export interface AttentionItem {
  id: string
  severity: "critical" | "warning"
  /** The server's three-step severity; `severity` folds "info" into "warning" */
  level: AlertSeverity
  title: string
  detail: string
  /** Share left (0–100), for chemicals */
  share?: number
  href: string
  action: string
  /** Open longer than its rule allows */
  escalated: boolean
  rule: string
  /** The day the problem started, when known */
  created: string | null
}

/** The query behind the bell and the dashboard panel; pages that change what is listed can invalidate it. */
export const ALERTS_KEY = ["alerts/notifications"]

/**
 * Things someone should act on, worked out by the server from the notification
 * rules (low stock, quarantine, overdue invoices, pending approvals, ...) for
 * the user's role. The list is already in order: escalated first, then the
 * most serious. The chemical and lot lists are the ones the dashboard shows
 * figures from; they are only fetched for roles that may see them.
 */
export function useAttention(role: Role | undefined) {
  const alerts = useQuery<AlertItem[]>({
    queryKey: ALERTS_KEY,
    queryFn: () => api("alerts/notifications"),
    enabled: !!role,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const chemicals = useQuery<Chemical[]>({
    queryKey: ["decolorization/chemicals", {}],
    queryFn: () => api("decolorization/chemicals"),
    enabled: canAccess(role, "/decolorization"),
  })
  const lots = useQuery<LotStock[]>({
    queryKey: ["inventory/movements/stock", {}],
    queryFn: () => api("inventory/movements/stock"),
    enabled: canAccess(role, "/sales"),
  })

  const items: AttentionItem[] = (alerts.data ?? []).map((a) => ({
    id: a.id,
    severity: a.severity === "danger" ? "critical" : "warning",
    level: a.severity,
    title: a.title,
    detail: a.message,
    ...(a.share === null ? {} : { share: a.share }),
    href: a.href,
    action: a.action,
    escalated: a.escalated,
    rule: a.rule,
    created: a.created,
  }))

  // The dashboard waits for the chemical list before it draws. Hold that list back until the
  // alerts have arrived too, so its "Needs attention" panel never shows "All clear" by mistake.
  const loadingAlerts = alerts.isPending && alerts.fetchStatus !== "idle"

  return {
    items,
    alerts,
    lots,
    chemicals: loadingAlerts ? ({ ...chemicals, data: undefined } as typeof chemicals) : chemicals,
    isPending: [alerts, chemicals, lots].some((q) => q.isPending && q.fetchStatus !== "idle"),
  }
}
