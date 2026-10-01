"use client"

import { useQuery } from "@tanstack/react-query"

import { canAccess, type NavIcon } from "@/config/access"
import { api } from "@/lib/api"
import type { DecolorizationSession, DryingSession, Role, SalesOrder, SortingSession, StockEntry } from "@/types/api"

// Shares the cache of each module's main list (same query keys as useList)
function useCount<T>(resource: string, enabled: boolean, count: (rows: T[]) => number) {
  const q = useQuery<T[]>({ queryKey: [resource, {}], queryFn: () => api(resource), enabled })
  return q.data ? count(q.data) : undefined
}

/** Small counts next to menu items: work waiting or running in each module. */
export function useNavCounts(role: Role | undefined): Partial<Record<NavIcon, { count: number; label: string }>> {
  const pending = useCount<StockEntry>("warehouse/stock", canAccess(role, "/warehouse"), (r) => r.filter((s) => s.status === "Pending").length)
  const sorting = useCount<SortingSession>("sorting/sessions", canAccess(role, "/sorting"), (r) => r.filter((s) => s.status === "In Progress").length)
  const decolor = useCount<DecolorizationSession>("decolorization/sessions", canAccess(role, "/decolorization"), (r) => r.filter((s) => s.status === "In Progress").length)
  const drying = useCount<DryingSession>("drying/sessions", canAccess(role, "/drying"), (r) => r.filter((s) => s.status === "In Progress").length)
  const toDispatch = useCount<SalesOrder>("sales/orders", canAccess(role, "/sales"), (r) => r.filter((o) => o.status === "Confirmed").length)

  const entry = (count: number | undefined, label: string) => (count ? { count, label: `${count} ${label}` } : undefined)
  return {
    warehouse: entry(pending, "pending deliveries"),
    sorting: entry(sorting, "sessions in progress"),
    decolorization: entry(decolor, "sessions in progress"),
    drying: entry(drying, "sessions in progress"),
    sales: entry(toDispatch, "orders awaiting dispatch"),
  }
}
