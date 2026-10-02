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
  "/production": ["admin", "sorting_supervisor", "decolorization_supervisor", "drying_supervisor"],
  "/procurement": ["admin", "warehouse_supervisor"],
  "/sales": ["admin"],
  "/finance": ["admin"],
  "/approvals": ["admin"],
  "/workforce": ["admin"],
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
  | "dashboard" | "warehouse" | "sorting" | "decolorization" | "drying" | "procurement" | "quality" | "production" | "sales" | "reports" | "users"
  | "traceability" | "approvals" | "finance" | "maintenance" | "sustainability" | "workforce" | "documents"

export interface NavItem {
  title: string
  href: string
  icon: NavIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: "dashboard" },
      { title: "Approvals", href: "/approvals", icon: "approvals" },
      { title: "Traceability", href: "/traceability", icon: "traceability" },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Warehouse", href: "/warehouse", icon: "warehouse" },
      { title: "Sorting", href: "/sorting", icon: "sorting" },
      { title: "Decolorization", href: "/decolorization", icon: "decolorization" },
      { title: "Drying", href: "/drying", icon: "drying" },
      { title: "Quality", href: "/quality", icon: "quality" },
      { title: "Production", href: "/production", icon: "production" },
      { title: "Maintenance", href: "/maintenance", icon: "maintenance" },
      { title: "Sustainability", href: "/sustainability", icon: "sustainability" },
    ],
  },
  {
    label: "Commercial",
    items: [
      { title: "Purchasing", href: "/procurement", icon: "procurement" },
      { title: "Sales", href: "/sales", icon: "sales" },
      { title: "Finance", href: "/finance", icon: "finance" },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Documents", href: "/documents", icon: "documents" },
      { title: "Workforce", href: "/workforce", icon: "workforce" },
      { title: "Reports", href: "/reports", icon: "reports" },
      { title: "Users", href: "/users", icon: "users" },
    ],
  },
]

export function navFor(role: Role | undefined): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => canAccess(role, i.href)) })).filter(
    (g) => g.items.length > 0,
  )
}
