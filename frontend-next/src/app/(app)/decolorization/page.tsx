import type { Metadata } from "next"

import { DecolorizationPage } from "@/features/decolorization/decolorization-page"

export const metadata: Metadata = { title: "Decolorization" }

export default function Page() {
  return <DecolorizationPage />
}
