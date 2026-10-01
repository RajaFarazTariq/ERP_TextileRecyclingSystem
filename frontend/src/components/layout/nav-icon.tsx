import {
  ClipboardList,
  Droplets,
  Factory,
  FileBarChart,
  LayoutDashboard,
  ListFilter,
  type LucideProps,
  ShieldCheck,
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
  procurement: ClipboardList,
  quality: ShieldCheck,
  production: Factory,
  sales: ShoppingCart,
  reports: FileBarChart,
  users: Users,
}

export function NavIcon({ name, ...props }: { name: NavIconName } & LucideProps) {
  const Icon = ICONS[name]
  return <Icon aria-hidden {...props} />
}
