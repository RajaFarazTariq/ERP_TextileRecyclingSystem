// Browser-side API client. Every call goes through this app's /api/django/
// route, which adds the session token server-side; see lib/server/session.ts.

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message)
  }

  /** Field → messages, for showing validation errors next to form fields. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {}
    if (this.body && typeof this.body === "object") {
      for (const [key, value] of Object.entries(this.body as Record<string, unknown>)) {
        if (key === "detail" || key === "non_field_errors") continue
        out[key] = Array.isArray(value) ? value.join(" ") : String(value)
      }
    }
    return out
  }
}

/** Turn a DRF error body into one readable sentence. */
export function errorMessage(body: unknown, fallback = "Something went wrong."): string {
  if (!body || typeof body !== "object") return fallback
  const data = body as Record<string, unknown>
  if (typeof data.detail === "string") return data.detail
  const parts = Object.values(data)
    .flat()
    .filter((v): v is string => typeof v === "string")
  return parts.join(" ") || fallback
}

type Params = Record<string, string | number | boolean | undefined | null>

export function toQuery(params?: Params): string {
  if (!params) return ""
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value))
  }
  const s = qs.toString()
  return s ? `?${s}` : ""
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; params?: Params } = {},
): Promise<T> {
  const { method = "GET", body, params } = options
  const res = await fetch(`/api/django/${path.replace(/^\/|\/$/g, "")}${toQuery(params)}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    // Full reload on purpose: drops all cached data from the expired session
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${next}`
  }
  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data, errorMessage(data, `Request failed (${res.status}).`))
  return data as T
}
