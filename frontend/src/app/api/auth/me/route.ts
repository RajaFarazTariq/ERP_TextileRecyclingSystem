import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { COOKIE, fetchSessionUser, parseUserCookie, refreshTokens, setSessionCookies } from "@/lib/server/session"

/**
 * The logged-in user (id, username, email, role, pages), or 401. The pages are
 * read from Django each time, so a change made by an admin shows up without
 * signing in again; the session cookie is brought up to date on the way.
 */
export async function GET() {
  const store = await cookies()
  const cached = parseUserCookie(store.get(COOKIE.user)?.value)
  const refresh = store.get(COOKIE.refresh)?.value
  if (!cached || !refresh) {
    return NextResponse.json({ detail: "Not logged in." }, { status: 401 })
  }

  let access = store.get(COOKIE.access)?.value
  let renewed: { access: string; refresh?: string } | null = null
  let user = access ? await fetchSessionUser(access).catch(() => null) : null
  if (!user) {
    renewed = await refreshTokens(refresh).catch(() => null)
    access = renewed?.access
    user = access ? await fetchSessionUser(access).catch(() => null) : null
  }
  if (!user || !access) {
    // Django can't be reached or the session has ended: answer with what we have
    return NextResponse.json(cached)
  }
  const response = NextResponse.json(user)
  setSessionCookies(response, renewed ?? { access }, user)
  return response
}
