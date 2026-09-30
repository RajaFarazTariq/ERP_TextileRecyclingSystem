import type { FieldValues, Path, UseFormSetError } from "react-hook-form"
import { z } from "zod"

import { ApiError } from "./api"

/** Show server validation errors next to the matching fields; returns any message left over. */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: string[]): string {
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again."
  const byField = error.fieldErrors
  let unmatched = false
  for (const [field, message] of Object.entries(byField)) {
    if (fields.includes(field)) setError(field as Path<T>, { type: "server", message })
    else unmatched = true
  }
  return unmatched || Object.keys(byField).length === 0 ? error.message : ""
}

/** A decimal kg/amount typed into a text box; kept as a string, which is what the API expects. */
export const decimalString = (label: string, { min = 0, allowZero = false } = {}) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}.`)
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), `${label[0].toUpperCase()}${label.slice(1)} must be a number with up to 2 decimals.`)
    .refine((v) => (allowZero ? Number(v) >= min : Number(v) > min), `${label[0].toUpperCase()}${label.slice(1)} must be greater than ${min}.`)

/** A required choice from a list of records, held as the id string a <Select> uses. */
export const requiredId = (label: string) => z.string().min(1, `Choose ${label}.`)
