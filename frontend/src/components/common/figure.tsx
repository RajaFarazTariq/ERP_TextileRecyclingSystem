"use client"

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { useId } from "react"

import { useCountUp } from "@/hooks/use-count-up"
import { cn } from "@/lib/utils"

// Formatted figures such as "Rs. 48,019,420", "126,280.14 kg" or "84.0%"
const FIGURE = /^(Rs\.\s)?(-?[\d,]*\.?\d+)(\s?kg|%)?$/

function Counting({ value, decimals }: { value: number; decimals: number }) {
  const shown = useCountUp(value)
  return <>{shown.toLocaleString("en-PK", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>
}

/**
 * Shows a figure with its unit smaller and muted, counting up on first show.
 * Anything that isn't a plain figure (e.g. "2 / 4", "—") is shown as is. The
 * text content stays the same as the input, e.g. "126,280.14 kg".
 */
export function Figure({ value, animate = true, unitClassName }: { value: React.ReactNode; animate?: boolean; unitClassName?: string }) {
  if (typeof value === "number") {
    return animate ? <Counting value={value} decimals={Number.isInteger(value) ? 0 : 1} /> : <>{value.toLocaleString("en-PK")}</>
  }
  if (typeof value !== "string") return <>{value}</>
  const m = FIGURE.exec(value)
  if (!m) return <>{value}</>
  const [, prefix, digits, suffix] = m
  const number = Number(digits.replace(/,/g, ""))
  const decimals = digits.includes(".") ? digits.split(".")[1].length : 0
  const unit = cn("font-sans text-[0.55em] font-medium text-muted-foreground", unitClassName)
  return (
    <>
      {prefix && <span className={unit}>Rs.</span>}
      {prefix && " "}
      {animate ? <Counting value={number} decimals={decimals} /> : digits}
      {suffix === "%" && <span className={unit}>%</span>}
      {suffix && suffix !== "%" && <>{" "}<span className={unit}>kg</span></>}
    </>
  )
}

/**
 * Change against the previous period, e.g. ▲ 12%. `goodWhen` says which
 * direction is good news (waste going down is good).
 */
export function Delta({ current, previous, goodWhen = "up", label }: {
  current: number
  previous: number
  goodWhen?: "up" | "down"
  label?: string
}) {
  if (!Number.isFinite(previous) || previous === 0) {
    return label ? <span className="text-xs text-muted-foreground">{current ? "New" : "No change"} {label}</span> : null
  }
  const change = ((current - previous) / Math.abs(previous)) * 100
  const flat = Math.abs(change) < 0.5
  const up = change > 0
  const good = flat ? null : (up ? goodWhen === "up" : goodWhen === "down")
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold",
          good === null ? "bg-muted text-muted-foreground" : good ? "bg-success/12 text-success-fg" : "bg-danger/12 text-danger-fg",
        )}
      >
        <Icon className="size-3" aria-hidden />
        {flat ? "0%" : `${Math.abs(change) >= 100 ? Math.round(Math.abs(change)) : Math.abs(change).toFixed(1)}%`}
        <span className="sr-only">{flat ? "no change" : up ? "increase" : "decrease"}</span>
      </span>
      {label && <span className="text-muted-foreground">{label}</span>}
    </span>
  )
}

/** A tiny trend line with a soft area fill; colour comes from `currentColor`. */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const id = useId()
  if (data.length < 2 || data.every((v) => v === 0)) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data.map((v, i) => [(i / (data.length - 1)) * 100, 26 - ((v - min) / range) * 22] as const)
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ")
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={cn("h-7 w-full overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,28 L0,28 Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
