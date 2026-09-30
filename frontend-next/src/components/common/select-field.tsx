"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface SelectOption {
  value: string
  label: string
}

/** A full-width Select for forms (value is the option's string id). */
export function SelectField({
  id,
  value,
  onChange,
  placeholder,
  options,
  invalid,
  allowNone,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: SelectOption[]
  invalid?: boolean
  /** Adds a "None" choice that maps to "" (for optional links) */
  allowNone?: string
}) {
  const NONE = "__none__"
  return (
    <Select value={value || (allowNone ? NONE : "")} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>{allowNone}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
