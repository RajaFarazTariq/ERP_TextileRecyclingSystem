import type { Metadata } from "next"

import { SortingPage } from "@/features/sorting/sorting-page"

export const metadata: Metadata = { title: "Sorting" }

export default function Page() {
  return <SortingPage />
}
