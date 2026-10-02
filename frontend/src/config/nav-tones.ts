import type { Tone } from "@/lib/tones"
import type { NavIcon } from "./access"

/** Colour of each module's icon: process stages use their stage colour. */
export const NAV_TONES: Record<NavIcon, Tone> = {
  dashboard: "brand",
  warehouse: "warehouse",
  sorting: "sorting",
  decolorization: "decolorization",
  drying: "drying",
  procurement: "procurement",
  quality: "quality",
  production: "production",
  finance: "finance",
  maintenance: "maintenance",
  sustainability: "sustainability",
  workforce: "workforce",
  documents: "documents",
  sales: "sales",
  reports: "running",
  users: "info",
}
