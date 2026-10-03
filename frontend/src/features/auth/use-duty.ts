"use client"

import { useCallback } from "react"

import type { Duty } from "@/types/api"
import { useSession } from "./use-session"

/**
 * What the logged-in user's role may do beyond opening pages (approve
 * purchases, release quarantine, ...). Duties are set per role under
 * Users → Access; admins have all of them. Django checks every action
 * itself, so this only decides which buttons are shown.
 */
export function useDuties() {
  const duties = useSession().data?.duties
  return useCallback((duty: Duty) => !!duties?.includes(duty), [duties])
}
