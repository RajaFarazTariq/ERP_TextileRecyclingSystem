import type { Metadata } from "next"

import { QualityPage } from "@/features/quality/quality-page"

export const metadata: Metadata = { title: "Quality" }

export default function Page() {
  return <QualityPage />
}
