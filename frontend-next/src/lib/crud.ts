"use client"

// Query and mutation hooks shared by every module: list a resource, create or
// update a record, delete a record. Mutations refresh the affected lists and
// report the outcome with a toast.
import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { ApiError, api } from "./api"

type Params = Record<string, string | number | boolean | undefined | null>

export function useList<T>(resource: string, params?: Params) {
  return useQuery<T[]>({
    queryKey: [resource, params ?? {}],
    queryFn: () => api<T[]>(resource, { params }),
  })
}

/** Create when `id` is absent, otherwise update (PATCH). */
export function useSave<T, Body = unknown>(resource: string, options: { invalidate?: QueryKey[]; noun: string }) {
  const qc = useQueryClient()
  return useMutation<T, ApiError, { id?: number; body: Body }>({
    mutationFn: ({ id, body }) =>
      api<T>(id ? `${resource}/${id}` : resource, { method: id ? "PATCH" : "POST", body }),
    onSuccess: (_data, { id }) => {
      toast.success(`${options.noun} ${id ? "updated" : "added"}.`)
      for (const key of [[resource], ...(options.invalidate ?? [])]) qc.invalidateQueries({ queryKey: key })
    },
  })
}

/**
 * A workflow action on one record, e.g. POST sorting/sessions/5/complete.
 * Refreshes the given lists and shows `success` as a toast.
 */
export function useAction<Body = unknown>(
  resource: string,
  action: string,
  options: { invalidate?: QueryKey[]; success: string },
) {
  const qc = useQueryClient()
  return useMutation<unknown, ApiError, { id: number; body?: Body }>({
    mutationFn: ({ id, body }) => api(`${resource}/${id}/${action}`, { method: "POST", body: body ?? {} }),
    onSuccess: () => {
      toast.success(options.success)
      for (const key of [[resource], ...(options.invalidate ?? [])]) qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useDelete(resource: string, options: { invalidate?: QueryKey[]; noun: string }) {
  const qc = useQueryClient()
  return useMutation<void, ApiError, number>({
    mutationFn: (id) => api<void>(`${resource}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(`${options.noun} deleted.`)
      for (const key of [[resource], ...(options.invalidate ?? [])]) qc.invalidateQueries({ queryKey: key })
    },
    // Errors (e.g. 409 "other records depend on it") are shown by the confirm dialog
  })
}
