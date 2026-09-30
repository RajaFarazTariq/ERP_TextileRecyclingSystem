// Route guard: sends visitors without a session to /login, and users without
// the right role for a page to the home page. (Django checks permissions on
// every API call as well; this only keeps people off pages they can't use.)
import { NextResponse, type NextRequest } from "next/server"

import { canAccess } from "@/config/access"
import type { Role } from "@/types/api"

const REFRESH_COOKIE = "erp_refresh"
const USER_COOKIE = "erp_user"

function roleFrom(request: NextRequest): Role | undefined {
  try {
    return JSON.parse(request.cookies.get(USER_COOKIE)?.value ?? "")?.role
  } catch {
    return undefined
  }
}

export function proxy(request: NextRequest) {
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
  if (!canAccess(roleFrom(request), pathname)) {
    return NextResponse.redirect(new URL("/", request.url))
  }
  return NextResponse.next()
}

export const config = {
  // Everything except API routes, Next.js assets and files with an extension
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
}
