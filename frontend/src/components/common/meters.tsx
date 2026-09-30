import { TONE, TONE_VAR, type Tone } from "@/lib/tones"
import { cn } from "@/lib/utils"

const clamp = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0)

/** A thin bar for a share (0–100), with an optional threshold tick (e.g. 25% reorder level). */
export function ProgressBar({
  value,
  tone = "brand",
  label,
  threshold,
  size = "md",
  className,
}: {
  value: number
  tone?: Tone
  /** Accessible name, e.g. "Caustic soda stock left" */
  label: string
  threshold?: number
  size?: "sm" | "md"
  className?: string
}) {
  const v = clamp(value)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative w-full rounded-full bg-muted", size === "sm" ? "h-1.5" : "h-2", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", TONE[tone].solid)}
        style={{ width: `${v}%` }}
      />
      {threshold !== undefined && (
        <span
          aria-hidden
          title={`${threshold}%`}
          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground/45"
          style={{ left: `calc(${clamp(threshold)}% - 1px)` }}
        />
      )}
    </div>
  )
}

export interface Segment {
  value: number
  tone: Tone
  label: string
}

/** Parts of a whole side by side, e.g. reserved vs free stock. */
export function SegmentedBar({ segments, label, className }: { segments: Segment[]; label: string; className?: string }) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0)
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={label}>
        {total > 0 && segments.map((s) => (
          <div key={s.label} className={cn("h-full first:rounded-l-full last:rounded-r-full", TONE[s.tone].solid)}
            style={{ width: `${(Math.max(0, s.value) / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", TONE[s.tone].solid)} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** A radial gauge for a percentage, with the figure in the middle. */
export function Gauge({ value, tone = "brand", size = 76, label }: { value: number; tone?: Tone; size?: number; label: string }) {
  const v = clamp(value)
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  // A 270° arc, open at the bottom
  const arc = c * 0.75
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="meter" aria-label={label}
      aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[135deg]" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke}
          strokeDasharray={`${arc} ${c}`} strokeLinecap="round" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE_VAR[tone]} strokeWidth={stroke}
          strokeDasharray={`${(arc * v) / 100} ${c}`} strokeLinecap="round"
          className="transition-[stroke-dasharray] duration-700 ease-out" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-heading text-sm font-bold">
        {Math.round(v)}<span className="text-[0.7em] font-medium text-muted-foreground">%</span>
      </span>
    </div>
  )
}

/**
 * Where the input went: output, waste and anything else (e.g. moisture lost),
 * as one bar. `parts` should add up to about `input`; the rest shows as muted.
 */
export function FlowBar({ input, parts, label }: { input: number; parts: Segment[]; label: string }) {
  const accounted = parts.reduce((a, p) => a + Math.max(0, p.value), 0)
  const rest = Math.max(0, input - accounted)
  const segments = rest > input * 0.001 ? [...parts, { value: rest, tone: "neutral" as Tone, label: "Other / in process" }] : parts
  const whole = Math.max(input, accounted) || 1
  return (
    <div className="space-y-2.5">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={label}>
        {segments.map((s) => (
          <div key={s.label} className={cn("h-full first:rounded-l-full last:rounded-r-full", TONE[s.tone].solid)}
            style={{ width: `${(Math.max(0, s.value) / whole) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className={cn("size-2.5 shrink-0 rounded-sm", TONE[s.tone].solid)} aria-hidden />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-semibold">{input ? `${((s.value / input) * 100).toFixed(1)}%` : "—"}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
