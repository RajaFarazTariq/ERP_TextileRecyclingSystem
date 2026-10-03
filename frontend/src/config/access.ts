// How the sidebar is grouped, and the check for "may this user open that page".
// Which pages a user has is decided in Django (Users → Access) and enforced on
// every API call; the web app reads the list from the session.

/** A role's name when the server didn't send one: "store_keeper" reads "Store Keeper". */
export const roleName = (key: string | undefined) =>
  (key ?? "").split("_").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")

/**
 * May a user with these pages open this path? A page's key is the first part
 * of its path ("/sales/..." is "sales"). The home page and anything that isn't
 * one of the menu pages are open to every logged-in user.
 */
export function canAccess(pages: readonly string[] | undefined, pathname: string): boolean {
  const key = pathname.split("/")[1] ?? ""
  return !PAGE_KEYS.has(key) || (pages ?? []).includes(key)
}

/** A user's pages, levels and duties as one string, to tell when they have changed. */
export const accessKey = (user: { pages: string[]; levels: Record<string, string>; duties?: string[]; role_label?: string }) =>
  [...user.pages.map((page) => `${page}:${user.levels[page] ?? "full"}`), ...(user.duties ?? []), user.role_label ?? ""].join()

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

const PAGE_KEYS = new Set(NAV.flatMap((g) => g.items.map((i) => i.href.slice(1))))

export function navFor(pages: readonly string[] | undefined): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => canAccess(pages, i.href)) })).filter(
    (g) => g.items.length > 0,
  )
}
