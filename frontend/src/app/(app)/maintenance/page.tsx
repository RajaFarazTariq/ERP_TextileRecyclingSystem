import type { Metadata } from "next"

import { MaintenancePage } from "@/features/maintenance/maintenance-page"

export const metadata: Metadata = { title: "Maintenance" }

export default function Page() {
  return <MaintenancePage />
}
