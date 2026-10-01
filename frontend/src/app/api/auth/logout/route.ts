import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { COOKIE, DJANGO_API_URL, clearSessionCookies, isSameOrigin } from "@/lib/server/session"

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-site request blocked." }, { status: 403 })
  }

  const refresh = (await cookies()).get(COOKIE.refresh)?.value
  if (refresh) {
    // Revoke the session in Django; logging out locally happens regardless.
    await fetch(`${DJANGO_API_URL}users/logout/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    }).catch(() => undefined)
  }

  const response = NextResponse.json({ ok: true })
  clearSessionCookies(response)
  return response
}
