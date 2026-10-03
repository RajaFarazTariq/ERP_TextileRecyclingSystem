import { z } from "zod"

import { ApiError, errorMessage } from "@/lib/api"
import { requiredId } from "@/lib/forms"
import type { StatusTone } from "@/lib/tones"
import type { DocumentStatus } from "@/types/documents"

export const STATUSES: DocumentStatus[] = ["Valid", "Expiring soon", "Expired", "No expiry"]
export const STATUS_TONES: Record<DocumentStatus, StatusTone> = {
  Valid: "success",
  "Expiring soon": "warning",
  Expired: "danger",
  "No expiry": "neutral",
}

export const LINK_TYPES = [
  "Supplier", "Purchase order", "Customer", "Sales order", "Invoice", "Fabric lot",
  "Production order", "Inspection", "Chemical", "Employee", "Machine", "Other",
] as const

// Used until the server's own limits arrive with the summary
export const DEFAULT_RULES = {
  maxMb: 10,
  extensions: ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "xls", "xlsx", "csv", "txt"],
}
export type UploadRules = typeof DEFAULT_RULES

export const documentSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200),
  category: requiredId("a category"),
  reference_number: z.string().trim().max(100),
  issued_on: z.string(),
  expires_on: z.string(),
  linked_type: z.string(),
  linked_label: z.string().trim().max(200),
  description: z.string().trim(),
}).superRefine((v, ctx) => {
  if (v.issued_on && v.expires_on && v.expires_on < v.issued_on) {
    ctx.addIssue({ code: "custom", path: ["expires_on"], message: "The expiry date can't be before the issue date." })
  }
  if (v.linked_type && !v.linked_label) {
    ctx.addIssue({ code: "custom", path: ["linked_label"], message: "Say which record this document belongs to." })
  }
})
export type DocumentForm = z.infer<typeof documentSchema>

const yesNo = z.enum(["yes", "no"])
export const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100),
  description: z.string().trim().max(255),
  is_active: yesNo,
  /** Role key → whether that role sees the category (admins always do) */
  roles: z.record(z.string(), yesNo),
})
export type CategoryForm = z.infer<typeof categorySchema>

/** "820 KB", "2.4 MB" */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** "in 12 days", "today", "5 days ago" */
export function daysText(days: number | null): string {
  if (days === null) return ""
  if (days === 0) return "today"
  const n = Math.abs(days)
  return days > 0 ? `in ${n} day${n === 1 ? "" : "s"}` : `${n} day${n === 1 ? "" : "s"} ago`
}

/** Why a chosen file can't be uploaded, or "" when it is fine. The server checks again. */
export function fileProblem(file: File | null, rules: UploadRules): string {
  if (!file) return "Choose a file to upload."
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : ""
  if (!rules.extensions.includes(extension)) return `This type of file is not allowed. Allowed types: ${rules.extensions.join(", ")}.`
  if (file.size > rules.maxMb * 1024 * 1024) return `The file is too large. The limit is ${rules.maxMb} MB.`
  if (file.size === 0) return "The file is empty."
  return ""
}

/**
 * Send a form with a file to the API. `api()` sends JSON only, so uploads go
 * through here; errors have the same shape as the ones `api()` throws.
 */
export async function upload<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`/api/django/${path}`, { method: "POST", body })
  const data = await res.json().catch(() => null)
  if (res.status === 401) throw new ApiError(401, data, "You are signed out. Sign in again to upload.")
  if (res.status === 413) throw new ApiError(413, data, "The file is too large.")
  if (!res.ok) throw new ApiError(res.status, data, errorMessage(data, `Upload failed (${res.status}).`))
  return data as T
}
