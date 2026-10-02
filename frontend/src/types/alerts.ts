// API types for notifications and approvals.
import type { Role } from "./api"

export type AlertSeverity = "info" | "warning" | "danger"

/** One open notification. Title and message read as one sentence. */
export interface AlertItem {
  /** Stable while the problem lasts, e.g. "invoice-overdue:42" */
  id: string
  rule: string
  title: string
  message: string
  severity: AlertSeverity
  href: string
  /** The day the problem started, when known */
  created: string | null
  escalated: boolean
  /** Link text, e.g. "Restock" */
  action: string
  /** Share left (0–100), for chemicals */
  share: number | null
}

export interface NotificationRule {
  id: number
  key: string
  title: string
  description: string
  is_enabled: boolean
  threshold: string | null
  /** What the threshold counts; empty when the rule has no number to set */
  threshold_label: string
  roles: Role[]
  /** Roles that can open the records behind the rule; only these can receive it */
  allowed_roles: Role[]
  send_email: boolean
  escalate_after_days: number | null
}

export type ApprovalKind =
  | "requisition" | "purchase_order" | "quarantine" | "production_order" | "sales_return" | "decolorization_batch" | "leave"

/** A decision the owning module offers, called at its own endpoint. */
export interface ApprovalAction {
  name: string
  label: string
  /** API path, e.g. "sales/returns/4/approve" */
  path: string
  success: string
  /** Field the endpoint reads its reason from, when it takes one */
  reason_field: string | null
  reason_required: boolean
}

export interface ApprovalItem {
  key: string
  id: number
  number: string
  title: string
  detail: string
  amount: string | null
  weight: string | null
  requested_by: string
  date: string
  age_days: number
  href: string
  actions: ApprovalAction[]
}

export interface ApprovalGroup {
  kind: ApprovalKind
  label: string
  count: number
  items: ApprovalItem[]
}

export interface ApprovalsInbox {
  total: number
  oldest_days: number | null
  groups: ApprovalGroup[]
}
