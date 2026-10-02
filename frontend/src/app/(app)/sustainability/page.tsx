import type { Metadata } from "next"

import { SustainabilityPage } from "@/features/sustainability/sustainability-page"

export const metadata: Metadata = { title: "Sustainability" }

export default function Page() {
  return <SustainabilityPage />
}
