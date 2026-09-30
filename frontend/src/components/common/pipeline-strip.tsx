"use client"

import Link from "next/link"

import { NavIcon } from "@/components/layout/nav-icon"
import type { NavIcon as NavIconName } from "@/config/access"
import { TONE, TONE_VAR, type StageTone } from "@/lib/tones"
import { cn } from "@/lib/utils"
import { Figure } from "./figure"

export interface PipelineStage {
  key: string
  title: string
  tone: StageTone
  icon: NavIconName
  href: string
  /** Main figure, e.g. kg("12,400") */
  value: string
  caption: string
  /** Work running in this stage right now */
  active?: number
  activeLabel?: string
}

function Connector({ tone }: { tone: StageTone }) {
  return (
    <div aria-hidden className="flex shrink-0 items-center justify-center py-1 md:w-7 md:py-0">
      <svg className="h-5 w-3 md:h-3 md:w-7" viewBox="0 0 28 12" preserveAspectRatio="none">
        <line x1="0" y1="6" x2="22" y2="6" stroke={TONE_VAR[tone]} strokeWidth="2" strokeDasharray="4 4"
          strokeLinecap="round" className="animate-flow max-md:hidden" />
        <path d="M21 1.5 L27 6 L21 10.5" fill="none" stroke={TONE_VAR[tone]} strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" className="max-md:hidden" />
        <line x1="14" y1="0" x2="14" y2="12" stroke={TONE_VAR[tone]} strokeWidth="2" strokeDasharray="3 3"
          className="md:hidden" />
      </svg>
    </div>
  )
}

/** The recycling flow at a glance; each stage links to its module. */
export function PipelineStrip({ stages, title, description }: { stages: PipelineStage[]; title: string; description?: string }) {
  return (
    <section className="surface animate-rise rounded-xl p-4 md:p-5" aria-label={title}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <ol className="flex flex-col md:flex-row md:items-stretch">
        {stages.map((s, i) => (
          <li key={s.key} className="contents">
            {i > 0 && <Connector tone={s.tone} />}
            <Link
              href={s.href}
              className={cn(
                "group relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-[color-mix(in_oklab,var(--card),var(--foreground)_2%)] p-3.5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg hover:shadow-black/5",
              )}
            >
              <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 opacity-80", TONE[s.tone].solid)} />
              <span aria-hidden className={cn("pointer-events-none absolute -top-10 -right-10 size-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-60", TONE[s.tone].solid)} />
              <div className="flex items-center gap-2.5">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONE[s.tone].soft, TONE[s.tone].text)}>
                  <NavIcon name={s.icon} className="size-4" />
                </span>
                <span className="truncate text-[13px] font-semibold">{s.title}</span>
              </div>
              <p className="mt-3 font-heading text-xl leading-tight font-bold tracking-tight">
                <Figure value={s.value} />
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.caption}</p>
              {s.activeLabel && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", s.active ? "animate-pulse-dot bg-running text-running" : "bg-faint")} aria-hidden />
                  {s.activeLabel}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
