// Server-only: talking to Django and keeping the session in httpOnly cookies.
// Browser code never sees the JWTs; it calls /api/django/* and this layer
// attaches the access token (renewing it with the refresh token when needed).
import "server-only"

import type { NextResponse } from "next/server"

import type { SessionUser } from "@/types/api"

export const DJANGO_API_URL = (process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000/api/v1/").replace(/\/?$/, "/")

export const COOKIE = {
  access: "erp_access",
  refresh: "erp_refresh",
  user: "erp_user",
} as const

// Secure cookies are only sent over HTTPS. Turn this on (SECURE_COOKIES=true)
// when the site is served over HTTPS; leave it off for plain-HTTP setups
// such as a factory LAN address, or browsers would drop the session cookie.
// (localhost counts as secure in browsers either way.)
const secure = process.env.SECURE_COOKIES === "true"

const base = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" }

// Access tokens live 30 minutes in Django; the refresh token 7 days.
const ACCESS_MAX_AGE = 60 * 30
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7

export function setSessionCookies(
  res: NextResponse,
  tokens: { access: string; refresh?: string },
  user?: SessionUser,
) {
  res.cookies.set(COOKIE.access, tokens.access, { ...base, maxAge: ACCESS_MAX_AGE })
  if (tokens.refresh) {
    res.cookies.set(COOKIE.refresh, tokens.refresh, { ...base, maxAge: REFRESH_MAX_AGE })
  }
  if (user) {
    // Role is used by the route guard; it is also enforced by Django on every call.
    res.cookies.set(COOKIE.user, JSON.stringify(user), { ...base, maxAge: REFRESH_MAX_AGE })
  }
}

export function clearSessionCookies(res: NextResponse) {
  for (const name of Object.values(COOKIE)) {
    res.cookies.set(name, "", { ...base, maxAge: 0 })
  }
}

export function parseUserCookie(value: string | undefined): SessionUser | null {
  if (!value) return null
  try {
    const user = JSON.parse(value)
    return user && typeof user.role === "string" ? (user as SessionUser) : null
  } catch {
    return null
  }
}

/** Exchange a refresh token for a new (rotated) pair. Returns null if it is no longer valid. */
export async function refreshTokens(refresh: string): Promise<{ access: string; refresh?: string } | null> {
  const res = await fetch(`${DJANGO_API_URL}users/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json()
}

/**
 * Reject state-changing requests that don't come from this site. The session
 * cookies are SameSite=Lax, and this check covers the rest (e.g. same-site
 * subdomains or older browsers).
 */
export function isSameOrigin(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true
  const origin = request.headers.get("origin")
  if (!origin) return false
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
