"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { canAccess } from "@/config/access"
import { useSession } from "@/features/auth/use-session"

/**
 * Keeps an open tab in step with the user's page access. The session is asked
 * again every minute and when the window gets focus; if an admin has changed
 * the user's pages, the menu is redrawn, and a page the user may no longer
 * open is left for the home page.
 */
export function AccessSync({ pages }: { pages: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const current = useSession().data?.pages

  useEffect(() => {
    if (!current) return
    if (!canAccess(current, pathname)) router.replace("/")
    else if (current.join() !== pages.join()) router.refresh()
  }, [current, pages, pathname, router])

  return null
}
