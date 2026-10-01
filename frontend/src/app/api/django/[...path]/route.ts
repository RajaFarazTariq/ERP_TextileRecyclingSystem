// Forwards /api/django/<path> to Django /api/v1/<path>/ with the session's
// access token. On a 401 it renews the token once with the refresh token and
// retries; if that fails the session is cleared and the client goes to /login.
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { forwardedHeaders } from "@/lib/server/forward"
import {
  COOKIE,
  DJANGO_API_URL,
  clearSessionCookies,
  isSameOrigin,
  refreshTokens,
  setSessionCookies,
} from "@/lib/server/session"

type Context = { params: Promise<{ path: string[] }> }

// Response headers worth passing back (e.g. Excel exports)
const PASS_HEADERS = ["content-type", "content-disposition", "cache-control"]

async function handle(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-site request blocked." }, { status: 403 })
  }

  const { path } = await params
  if (path.some((part) => part === ".." || part.includes("\\"))) {
    return NextResponse.json({ detail: "Invalid path." }, { status: 400 })
  }
  const search = new URL(request.url).search
  const target = `${DJANGO_API_URL}${path.map(encodeURIComponent).join("/")}/${search}`

  const store = await cookies()
  let access = store.get(COOKIE.access)?.value
  const refresh = store.get(COOKIE.refresh)?.value
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer()

  const send = (token?: string) =>
    fetch(target, {
      method: request.method,
      headers: {
        ...forwardedHeaders(request),
        ...(request.headers.get("content-type") ? { "Content-Type": request.headers.get("content-type")! } : {}),
        Accept: request.headers.get("accept") ?? "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      cache: "no-store",
      redirect: "manual",
    })

  let renewed: { access: string; refresh?: string } | null = null
  if (!access && refresh) {
    renewed = await refreshTokens(refresh)
    access = renewed?.access
  }
  let upstream = await send(access)
  if (upstream.status === 401 && refresh && !renewed) {
    renewed = await refreshTokens(refresh)
    if (renewed) upstream = await send(renewed.access)
  }

  const headers = new Headers()
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  const response = new NextResponse(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers,
  })

  if (renewed) setSessionCookies(response, renewed)
  else if (upstream.status === 401) clearSessionCookies(response)
  return response
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE }
