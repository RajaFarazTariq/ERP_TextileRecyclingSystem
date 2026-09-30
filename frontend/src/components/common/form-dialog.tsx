"use client"

import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/**
 * Create/edit form in a side sheet: title at the top, fields in a scrolling
 * body, and the actions pinned to the bottom. Pass `className="sm:max-w-xl"`
 * for a wider sheet.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  error,
  submitting,
  submitLabel = "Save",
  onSubmit,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  error?: string
  submitting?: boolean
  submitLabel?: string
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  children: React.ReactNode
  className?: string
}) {
  const wide = className?.includes("max-w-xl") || className?.includes("max-w-2xl")
  return (
    <Sheet open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <SheetContent
        side="right"
        className={cn(
          "gap-0 bg-elevated p-0 data-[side=right]:w-full",
          wide ? "data-[side=right]:sm:max-w-xl" : "data-[side=right]:sm:max-w-lg",
        )}
      >
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <SheetHeader className="border-b px-6 pt-5 pb-4">
            <SheetTitle className="font-heading text-lg font-semibold tracking-tight">{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
          </SheetHeader>
          <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger-fg">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}
            <div className="grid gap-4">{children}</div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t bg-[color-mix(in_oklab,var(--elevated),var(--foreground)_2%)] px-6 py-3.5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="min-w-24">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/** A heading that groups related fields inside a form. */
export function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</legend>
      {children}
    </fieldset>
  )
}

// "Weight (kg)" → label "Weight" with a "kg" suffix in the input; "Amount (Rs.)" → "Rs." prefix
const UNIT = /^(.*)\s\((kg|Rs\.)\)$/

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  const unit = UNIT.exec(label)
  return (
    // content-start: a long error under one field mustn't stretch its neighbours in the same row
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium">
        {unit ? <>{unit[1]}<span className="sr-only"> ({unit[2]})</span></> : label}
      </Label>
      {unit ? (
        <div className={cn("relative", unit[2] === "kg" ? "[&_input]:pr-10" : "[&_input]:pl-11")}>
          {children}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground",
              unit[2] === "kg" ? "right-3" : "left-3",
            )}
          >
            {unit[2]}
          </span>
        </div>
      ) : (
        children
      )}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
