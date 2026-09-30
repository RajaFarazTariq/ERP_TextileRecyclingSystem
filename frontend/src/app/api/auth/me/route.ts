import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { COOKIE, parseUserCookie } from "@/lib/server/session"

/** The logged-in user (id, username, email, role), or 401. */
export async function GET() {
  const store = await cookies()
  const user = parseUserCookie(store.get(COOKIE.user)?.value)
  if (!user || !store.get(COOKIE.refresh)) {
    return NextResponse.json({ detail: "Not logged in." }, { status: 401 })
  }
  return NextResponse.json(user)
}
