import { initials } from "@/lib/format"
import { TONE, type Tone } from "@/lib/tones"
import { cn } from "@/lib/utils"

const AVATAR_TONES: Tone[] = ["warehouse", "sorting", "decolorization", "drying", "sales", "running", "info", "warning"]

function toneFor(name: string): Tone {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

/** Initials in a tinted circle; the same name always gets the same colour. */
export function InitialsAvatar({ name, size = "sm", className }: { name: string; size?: "xs" | "sm" | "md"; className?: string }) {
  const tone = toneFor(name)
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        { xs: "size-6 text-[10px]", sm: "size-7 text-[11px]", md: "size-9 text-xs" }[size],
        TONE[tone].soft,
        TONE[tone].text,
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

/** A name with its avatar, for table cells. */
export function NameWithAvatar({ name, sub, className }: { name: string; sub?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <InitialsAvatar name={name} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
    </span>
  )
}

/** Vehicle number in a number-plate style chip. */
export function PlateChip({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center rounded-md border border-border-strong bg-muted/70 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wider uppercase shadow-[inset_0_-1px_0_var(--border)]">
      {value}
    </span>
  )
}
