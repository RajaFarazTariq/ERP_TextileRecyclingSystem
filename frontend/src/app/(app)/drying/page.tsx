import type { Metadata } from "next"

import { DryingPage } from "@/features/drying/drying-page"

export const metadata: Metadata = { title: "Drying" }

export default function Page() {
  return <DryingPage />
}
