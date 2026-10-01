import type { Metadata } from "next"

import { ProcurementPage } from "@/features/procurement/procurement-page"

export const metadata: Metadata = { title: "Purchasing" }

export default function Page() {
  return <ProcurementPage />
}
