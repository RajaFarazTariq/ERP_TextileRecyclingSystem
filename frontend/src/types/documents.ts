// API types for the Documents module.
import type { Role } from "./api"

export type DocumentStatus = "Valid" | "Expiring soon" | "Expired" | "No expiry"

export interface DocumentCategory {
  id: number
  name: string
  description: string
  /** Roles that may see the category's documents; admins always may */
  allowed_roles: Role[]
  is_active: boolean
  documents: number
}

export interface DocumentRecord {
  id: number
  number: string
  title: string
  category: number
  category_name: string
  description: string
  reference_number: string
  issued_on: string | null
  expires_on: string | null
  status: DocumentStatus
  /** Days until the expiry date; negative once expired, null without one */
  days_left: number | null
  linked_type: string
  linked_id: number | null
  linked_label: string
  current_version: number
  file_name: string
  extension: string
  size_bytes: number
  updated_at: string
  /** Whether this user may edit the details and add versions */
  can_change: boolean
  created_by: number
  created_by_name: string
  created_at: string
}

export interface DocumentVersion {
  id: number
  version: number
  original_name: string
  extension: string
  size_bytes: number
  content_type: string
  sha256: string
  note: string
  uploaded_by: number
  uploaded_by_name: string
  uploaded_at: string
}

export interface DocumentSummary {
  documents: number
  valid: number
  expiring_soon: number
  expired: number
  no_expiry: number
  added_this_month: number
  by_category: { category: number; name: string; count: number }[]
  expiring_days: number
  max_upload_mb: number
  allowed_extensions: string[]
}
