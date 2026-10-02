"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Field, FieldGroup, FormDialog } from "@/components/common/form-dialog"
import { SelectField } from "@/components/common/select-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ROLE_LABELS } from "@/config/access"
import { type ApiError, api } from "@/lib/api"
import { useSave } from "@/lib/crud"
import { applyServerErrors } from "@/lib/forms"
import type { ApprovalAction, ApprovalItem, NotificationRule } from "@/types/alerts"
import { type RuleForm, ruleSchema } from "./schemas"

const YES_NO = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]

// ─── A decision on one waiting item ─────────────────────────────────────────

export interface Decision {
  item: ApprovalItem
  action: ApprovalAction
}

export function DecisionDialog({ decision, onOpenChange }: { decision: Decision | null; onOpenChange: (o: boolean) => void }) {
  return decision ? <DecisionDialogBody key={`${decision.item.key}-${decision.action.name}`} decision={decision} onOpenChange={onOpenChange} /> : null
}

/** Confirms the decision, asks for a reason where the module's endpoint takes one, and shows what the module answers. */
function DecisionDialogBody({ decision: { item, action }, onOpenChange }: { decision: Decision; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  // The decision is made by the module that owns the record, at its own endpoint
  const decide = useMutation<unknown, ApiError, void>({
    mutationFn: () => api(action.path, { method: "POST", body: action.reason_field ? { [action.reason_field]: reason.trim() } : {} }),
    onSuccess: () => {
      toast.success(action.success)
      // A decision changes lists all over the app (stock, orders, balances): refresh everything but the login
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "session" })
    },
  })
  const verb = action.label.toLowerCase()

  return (
    <FormDialog open onOpenChange={onOpenChange} title={`${action.label} ${item.number}?`}
      description={[item.title, item.detail].filter(Boolean).join(" · ")}
      error={error} submitting={decide.isPending} submitLabel={action.label}
      onSubmit={async (e) => {
        e.preventDefault()
        setError("")
        if (action.reason_required && !reason.trim()) return setError(`Say why you ${verb} it.`)
        try {
          await decide.mutateAsync()
          onOpenChange(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : `Could not ${verb} it.`)
        }
      }}>
      {action.reason_field ? (
        <Field id="decision-reason" label={action.reason_required ? "Reason" : "Note"}
          hint={action.reason_required ? "It is kept with the record." : "Optional. It is kept with the record."}>
          <Textarea id="decision-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      ) : (
        <p className="text-sm text-muted-foreground">This is recorded under your name.</p>
      )}
    </FormDialog>
  )
}

// ─── Notification rule ──────────────────────────────────────────────────────

export function RuleDialog({ rule, onOpenChange }: { rule: NotificationRule | null; onOpenChange: (o: boolean) => void }) {
  return rule ? <RuleDialogBody key={rule.id} rule={rule} onOpenChange={onOpenChange} /> : null
}

function RuleDialogBody({ rule, onOpenChange }: { rule: NotificationRule; onOpenChange: (o: boolean) => void }) {
  const save = useSave<NotificationRule>("alerts/rules", { noun: "Rule", invalidate: [["alerts/notifications"]] })
  const [formError, setFormError] = useState("")
  const form = useForm<RuleForm>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      is_enabled: rule.is_enabled ? "yes" : "no",
      threshold: rule.threshold === null ? "" : String(Number(rule.threshold)),
      roles: Object.fromEntries(rule.allowed_roles.map((r) => [r, rule.roles.includes(r) ? "yes" : "no"])),
      send_email: rule.send_email ? "yes" : "no",
      escalate_after_days: rule.escalate_after_days === null ? "" : String(rule.escalate_after_days),
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError("")
    if (rule.threshold_label && !values.threshold) return form.setError("threshold", { message: "Enter a number." })
    try {
      await save.mutateAsync({
        id: rule.id,
        body: {
          is_enabled: values.is_enabled === "yes",
          ...(rule.threshold_label ? { threshold: values.threshold } : {}),
          roles: rule.allowed_roles.filter((r) => values.roles[r] === "yes"),
          send_email: values.send_email === "yes",
          escalate_after_days: values.escalate_after_days ? Number(values.escalate_after_days) : null,
        },
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["is_enabled", "threshold", "send_email", "escalate_after_days"]))
    }
  })

  return (
    <FormDialog open onOpenChange={onOpenChange} title={rule.title} description={rule.description}
      error={formError} submitting={isSubmitting} submitLabel="Update" onSubmit={onSubmit}>
      <Field id="rule-enabled" label="Switched on">
        <Controller control={form.control} name="is_enabled" render={({ field }) => (
          <SelectField id="rule-enabled" value={field.value} onChange={field.onChange} placeholder="Select" options={YES_NO} />
        )} />
      </Field>
      {rule.threshold_label && (
        <Field id="rule-threshold" label={rule.threshold_label} error={errors.threshold?.message}>
          <Input id="rule-threshold" inputMode="decimal" aria-invalid={!!errors.threshold} {...form.register("threshold")} />
        </Field>
      )}
      <FieldGroup title="Who receives it">
        <p className="text-sm text-muted-foreground">
          {rule.allowed_roles.length
            ? "Admins always receive it. Choose who else does."
            : "Admins only. The records behind this rule are not open to other roles."}
        </p>
        {rule.allowed_roles.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {rule.allowed_roles.map((role) => (
              <Field key={role} id={`rule-role-${role}`} label={ROLE_LABELS[role]}>
                <Controller control={form.control} name={`roles.${role}`} render={({ field }) => (
                  <SelectField id={`rule-role-${role}`} value={field.value} onChange={field.onChange} placeholder="Select" options={YES_NO} />
                )} />
              </Field>
            ))}
          </div>
        )}
      </FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rule-email" label="Send by e-mail" hint="Adds its items to the e-mail digest for management.">
          <Controller control={form.control} name="send_email" render={({ field }) => (
            <SelectField id="rule-email" value={field.value} onChange={field.onChange} placeholder="Select" options={YES_NO} />
          )} />
        </Field>
        <Field id="rule-escalate" label="Escalate after days" error={errors.escalate_after_days?.message}
          hint="An item open this long is marked as escalated and listed first. Empty: never.">
          <Input id="rule-escalate" inputMode="numeric" aria-invalid={!!errors.escalate_after_days} {...form.register("escalate_after_days")} />
        </Field>
      </div>
    </FormDialog>
  )
}
