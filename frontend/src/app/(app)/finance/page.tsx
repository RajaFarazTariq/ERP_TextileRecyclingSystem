import type { Metadata } from "next"

import { FinancePage } from "@/features/finance/finance-page"

export const metadata: Metadata = { title: "Finance" }

export default function Page() {
  return <FinancePage />
}
