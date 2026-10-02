"use client"

import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

import { roleName } from "@/config/access"
import { api } from "@/lib/api"

export interface RoleName {
  key: string
  name: string
}

/** Every role and what it is called, built-in roles first. Any signed-in user may read it. */
export function useRoles() {
  const roles = useQuery<RoleName[]>({ queryKey: ["access/role-names"], queryFn: () => api("access/role-names"), staleTime: 60_000 })
  const data = roles.data
  const label = useCallback((key: string) => data?.find((r) => r.key === key)?.name ?? roleName(key), [data])
  return { roles: data ?? [], label, isPending: roles.isPending }
}
