"use client"

import { useQuery } from "@tanstack/react-query"

import type { SessionUser } from "@/types/api"

export function useSession() {
  return useQuery<SessionUser>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) throw new Error("Not logged in")
      return res.json()
    },
    staleTime: Infinity,
  })
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
  // Full reload on purpose: drops all cached data from the session
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/login"
}
