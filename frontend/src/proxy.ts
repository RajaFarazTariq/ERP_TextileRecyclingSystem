// Route guard: sends visitors without a session to /login, and users who may
// not open a page to the home page. Which pages a user has is decided in
// Django (Users → Access). The list travels in the session cookie and is
// checked against Django again on every page load, so a change made by an
// admin applies to the very next page a user opens, typed address included.
// (Django also checks every API call; this keeps people off pages they can't use.)
import { NextResponse, type NextRequest } from "next/server"

import { canAccess } from "@/config/access"

const ACCESS_COOKIE = "erp_access"
const REFRESH_COOKIE = "erp_refresh"
const USER_COOKIE = "erp_user"
const DJANGO_API_URL = (process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000/api/v1/").replace(/\/?$/, "/")
const USER_COOKIE_OPTIONS = {
  httpOnly: true, sameSite: "lax" as const, secure: process.env.SECURE_COOKIES === "true", path: "/", maxAge: 60 * 60 * 24 * 7,
}

interface CookieUser {
  role?: string
  pages?: string[]
}

function userFrom(request: NextRequest): CookieUser | undefined {
  try {
    return JSON.parse(request.cookies.get(USER_COOKIE)?.value ?? "")
  } catch {
    return undefined
  }
}

/** The user's pages as Django has them now. Undefined when Django can't say (down, slow, token expired). */
async function currentUser(request: NextRequest): Promise<CookieUser | undefined> {
  const access = request.cookies.get(ACCESS_COOKIE)?.value
  if (!access) return undefined
  try {
    const res = await fetch(`${DJANGO_API_URL}access/me/`, {
      headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    })
    return res.ok ? await res.json() : undefined
  } catch {
    return undefined
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const loggedIn = request.cookies.has(REFRESH_COOKIE)

  if (pathname === "/login") {
    return loggedIn ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next()
  }
  if (!loggedIn) {
    const url = new URL("/login", request.url)
    if (pathname !== "/") url.searchParams.set("next", pathname + search)
    return NextResponse.redirect(url)
  }

  const cached = userFrom(request)
  // Link prefetches are guesses, not visits: they use the list in the cookie
  const fresh = request.headers.has("next-router-prefetch") ? undefined : await currentUser(request)
  const user = fresh ?? cached
  const changed = !!fresh && JSON.stringify(fresh.pages) !== JSON.stringify(cached?.pages)

  const keep = (response: NextResponse) => {
    if (changed) response.cookies.set(USER_COOKIE, JSON.stringify(fresh), USER_COOKIE_OPTIONS)
    return response
  }
  if (!canAccess(user?.pages, pathname)) {
    return keep(NextResponse.redirect(new URL("/", request.url)))
  }
  if (!changed) return NextResponse.next()
  // The page being rendered now reads the cookie too: hand it the fresh one
  request.cookies.set(USER_COOKIE, JSON.stringify(fresh))
  return keep(NextResponse.next({ request: { headers: request.headers } }))
}

export const config = {
  // Everything except API routes, Next.js assets and files with an extension
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
}
