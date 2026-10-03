"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { accessKey, canAccess } from "@/config/access"
import { useSession } from "@/features/auth/use-session"

/**
 * Keeps an open tab in step with the user's page access. The session is asked
 * again every minute and when the window gets focus; if an admin has changed
 * the user's pages, the menu is redrawn, and a page the user may no longer
 * open is left for the home page.
 */
export function AccessSync({ access }: { access: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const session = useSession().data
  const current = session ? accessKey(session) : undefined
  const pages = session?.pages

  useEffect(() => {
    if (!current || !pages) return
    if (!canAccess(pages, pathname)) router.replace("/")
    else if (current !== access) router.refresh()
  }, [current, pages, access, pathname, router])

  return null
}
