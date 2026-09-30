import {
  Droplets,
  FileBarChart,
  LayoutDashboard,
  ListFilter,
  type LucideProps,
  ShoppingCart,
  Users,
  Warehouse,
  Wind,
} from "lucide-react"

import type { NavIcon as NavIconName } from "@/config/access"

const ICONS: Record<NavIconName, React.ComponentType<LucideProps>> = {
  dashboard: LayoutDashboard,
  warehouse: Warehouse,
  sorting: ListFilter,
  decolorization: Droplets,
  drying: Wind,
  sales: ShoppingCart,
  reports: FileBarChart,
  users: Users,
}

export function NavIcon({ name, ...props }: { name: NavIconName } & LucideProps) {
  const Icon = ICONS[name]
  return <Icon aria-hidden {...props} />
}
