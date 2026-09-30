// Which roles may open each page, and how the sidebar is grouped.
// Django enforces the same rules on every API call; this only decides what
// the interface shows and where the route guard redirects.
import type { Role } from "@/types/api"

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  warehouse_supervisor: "Warehouse Supervisor",
  sorting_supervisor: "Sorting Supervisor",
  decolorization_supervisor: "Decolorization Supervisor",
  drying_supervisor: "Drying Supervisor",
}

export const ROUTE_ROLES: Record<string, Role[]> = {
  "/dashboard": ["admin"],
  "/warehouse": ["admin", "warehouse_supervisor"],
  "/sorting": ["admin", "sorting_supervisor"],
  "/decolorization": ["admin", "decolorization_supervisor"],
  "/drying": ["admin", "drying_supervisor"],
  "/sales": ["admin"],
  "/reports": ["admin"],
  "/users": ["admin"],
}

/** Routes not listed above are open to any logged-in user. */
export function canAccess(role: Role | undefined, pathname: string): boolean {
  const base = "/" + (pathname.split("/")[1] ?? "")
  const roles = ROUTE_ROLES[base]
  return !roles || (!!role && roles.includes(role))
}

export type NavIcon =
  | "dashboard" | "warehouse" | "sorting" | "decolorization" | "drying" | "sales" | "reports" | "users"

export interface NavItem {
  title: string
  href: string
  icon: NavIcon
  /** false = not moved to this app yet; the link opens the classic app */
  migrated: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: "dashboard", migrated: true }],
  },
  {
    label: "Operations",
    items: [
      { title: "Warehouse", href: "/warehouse", icon: "warehouse", migrated: true },
      { title: "Sorting", href: "/sorting", icon: "sorting", migrated: true },
      { title: "Decolorization", href: "/decolorization", icon: "decolorization", migrated: true },
      { title: "Drying", href: "/drying", icon: "drying", migrated: true },
    ],
  },
  {
    label: "Commercial",
    items: [{ title: "Sales", href: "/sales", icon: "sales", migrated: true }],
  },
  {
    label: "Administration",
    items: [
      { title: "Reports", href: "/reports", icon: "reports", migrated: true },
      { title: "Users", href: "/users", icon: "users", migrated: true },
    ],
  },
]

export function navFor(role: Role | undefined): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => canAccess(role, i.href)) })).filter(
    (g) => g.items.length > 0,
  )
}

/** Pages still served by the classic React app (see NEXT_PUBLIC_LEGACY_APP_URL). */
export const LEGACY_APP_URL = (process.env.NEXT_PUBLIC_LEGACY_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
