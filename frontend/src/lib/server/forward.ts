import "server-only"

/**
 * Headers to send to Django for a browser request: the client's address (so
 * Django's login rate limit and audit log see the real user, not this server)
 * and the user agent.
 *
 * Behind nginx the last X-Forwarded-For entry is the one nginx added; earlier
 * entries come from the client and can't be trusted, so only the last is kept.
 */
export function forwardedHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {}
  const chain = request.headers.get("x-forwarded-for")
  const client = chain ? chain.split(",").pop()?.trim() : request.headers.get("x-real-ip")
  if (client) headers["X-Forwarded-For"] = client
  const agent = request.headers.get("user-agent")
  if (agent) headers["User-Agent"] = agent
  return headers
}
