"use client"

import { usePathname } from "next/navigation"

import { useSession } from "./use-session"

// Pages that only show things: holding them to "view" changes nothing
const NOTHING_TO_CHANGE = new Set(["dashboard", "traceability", "reports"])

/**
 * How far the logged-in user may go on the page they are on. `readOnly` is
 * true when they hold it to view: the page then hides its add, edit and
 * delete controls, and Django refuses changes whatever the screen shows.
 */
export function usePageAccess() {
  const page = usePathname().split("/")[1] ?? ""
  const level = useSession().data?.levels?.[page]
  return { page, level, readOnly: level === "view" && !NOTHING_TO_CHANGE.has(page) }
}
