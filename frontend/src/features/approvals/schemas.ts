import { z } from "zod"

import type { ApprovalKind } from "@/types/alerts"

const yesNo = z.enum(["yes", "no"])

export const ruleSchema = z.object({
  is_enabled: yesNo,
  threshold: z.string().trim().refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Enter a number with up to 2 decimals."),
  /** Role key → whether that role receives the rule's notifications */
  roles: z.record(z.string(), yesNo),
  send_email: yesNo,
  escalate_after_days: z.string().trim().refine((v) => v === "" || /^\d{1,4}$/.test(v), "Enter whole days, or leave it empty."),
})
export type RuleForm = z.infer<typeof ruleSchema>

/** Column headings and the empty message for each kind of approval. */
export const KINDS: Record<ApprovalKind, { what: string; who: string | null; empty: string }> = {
  requisition: { what: "Materials", who: "Requested by", empty: "Purchase requests show here once they are submitted." },
  purchase_order: { what: "Supplier", who: "Raised by", empty: "Purchase orders show here once they are submitted, and again after an approved order is changed." },
  quarantine: { what: "Material", who: "Inspected by", empty: "Material that fails an inspection waits here until you release it." },
  production_order: { what: "Product", who: "Planned by", empty: "Draft production orders wait here until you release them to the floor." },
  sales_return: { what: "Customer", who: "Recorded by", empty: "Customer returns wait here until you approve or reject them." },
  decolorization_batch: { what: "Material", who: "Supervisor", empty: "Completed decolorization batches wait here for your sign-off." },
  // The employee is the title already
  leave: { what: "Employee", who: null, empty: "Leave requests wait here until you approve or reject them." },
}
