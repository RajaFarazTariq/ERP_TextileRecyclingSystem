import {
  ClipboardList,
  Contact,
  Droplets,
  Factory,
  FileBarChart,
  FolderOpen,
  Landmark,
  LayoutDashboard,
  Leaf,
  ListFilter,
  type LucideProps,
  ShieldCheck,
  ShoppingCart,
  Users,
  Warehouse,
  Wind,
  Wrench,
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
  finance: Landmark,
  maintenance: Wrench,
  sustainability: Leaf,
  workforce: Contact,
  documents: FolderOpen,
  sales: ShoppingCart,
  reports: FileBarChart,
  users: Users,
}

export function NavIcon({ name, ...props }: { name: NavIconName } & LucideProps) {
  const Icon = ICONS[name]
  return <Icon aria-hidden {...props} />
}
