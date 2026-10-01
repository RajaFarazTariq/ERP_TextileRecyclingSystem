"use client"

import { useQuery } from "@tanstack/react-query"

import { canAccess } from "@/config/access"
import { chemicalShareLeft, isLowStock } from "@/features/decolorization/decolorization-dashboard"
import { api } from "@/lib/api"
import type { Chemical, Inspection, LotStock, Role } from "@/types/api"

export interface AttentionItem {
  id: string
  severity: "critical" | "warning"
  title: string
  detail: string
  /** Share left (0–100), for chemicals */
  share?: number
  href: string
  action: string
}

const n = (v: string | number | null | undefined) => Number(v) || 0

/**
 * Things someone should act on: chemicals below the reorder level, lots with
 * more reserved than on hand, and material in quarantine. Uses the same lists
 * (and cache) as the module pages; only fetches what the role may see.
 */
export function useAttention(role: Role | undefined) {
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
  const inspections = useQuery<Inspection[]>({
    queryKey: ["quality/inspections", {}],
    queryFn: () => api("quality/inspections"),
    enabled: canAccess(role, "/quality"),
  })

  const items: AttentionItem[] = [
    ...(inspections.data ?? []).filter((i) => i.quarantined).map((i): AttentionItem => ({
      id: `quarantine-${i.id}`,
      severity: "critical",
      title: `${i.material} (${i.target.toLowerCase()})`,
      detail: `is in quarantine after failing ${i.number}`,
      href: "/quality",
      action: "Review",
    })),
    ...(chemicals.data ?? []).filter(isLowStock).map((c): AttentionItem => {
      const share = chemicalShareLeft(c) * 100
      return {
        id: `chemical-${c.id}`,
        severity: share < 10 ? "critical" : "warning",
        title: c.chemical_name,
        detail: `is below 25% (${n(c.remaining_stock).toLocaleString()} ${c.unit_of_measure} left)`,
        share,
        href: "/decolorization",
        action: "Restock",
      }
    }),
    ...(lots.data ?? []).filter((l) => n(l.available_kg) < 0).map((l): AttentionItem => ({
      id: `lot-${l.fabric}`,
      severity: "critical",
      title: l.material_type,
      detail: `has more reserved than on hand (${(-n(l.available_kg)).toLocaleString("en-PK", { maximumFractionDigits: 2 })} kg short)`,
      href: "/sales",
      action: "View",
    })),
  ].sort((a, b) => (a.severity === b.severity ? (a.share ?? -1) - (b.share ?? -1) : a.severity === "critical" ? -1 : 1))

  return {
    items,
    lots,
    chemicals,
    isPending: (chemicals.isPending && chemicals.fetchStatus !== "idle") || (lots.isPending && lots.fetchStatus !== "idle"),
  }
}
