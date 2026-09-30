import type { Tone } from "@/lib/tones"
import type { NavIcon } from "./access"

/** Colour of each module's icon: process stages use their stage colour. */
export const NAV_TONES: Record<NavIcon, Tone> = {
  dashboard: "brand",
  warehouse: "warehouse",
  sorting: "sorting",
  decolorization: "decolorization",
  drying: "drying",
  sales: "sales",
  reports: "running",
  users: "info",
}
