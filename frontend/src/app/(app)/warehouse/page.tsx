import type { Metadata } from "next"

import { WarehousePage } from "@/features/warehouse/warehouse-page"

export const metadata: Metadata = { title: "Warehouse" }

export default function Page() {
  return <WarehousePage />
}
