import { NextResponse } from "next/server"

import { forwardedHeaders } from "@/lib/server/forward"
import { DJANGO_API_URL, isSameOrigin, setSessionCookies } from "@/lib/server/session"

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-site request blocked." }, { status: 403 })
  }

  const body = await request.text()
  const res = await fetch(`${DJANGO_API_URL}users/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...forwardedHeaders(request) },
    body,
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // 400 bad credentials / inactive, 429 rate limited: pass the message through
    return NextResponse.json(data, { status: res.status })
  }

  const response = NextResponse.json({ user: data.user })
  setSessionCookies(response, data.token, data.user)
  return response
}
