// One colour language for the whole app. Status tones follow the semantic
// palette (sky = received/info, amber = pending/warning, emerald = done,
// violet = running, rose = error/maintenance); stage tones colour each step of
// the recycling process. Class names are spelled out so Tailwind can see them.

export type StatusTone = "neutral" | "info" | "warning" | "success" | "running" | "danger"
export type StageTone = "warehouse" | "sorting" | "decolorization" | "drying" | "sales" | "procurement" | "quality" | "production"
  | "finance" | "maintenance" | "sustainability" | "workforce" | "documents"
export type Tone = StatusTone | StageTone | "brand"

export const TONE: Record<Tone, { text: string; soft: string; solid: string; border: string }> = {
  neutral: { text: "text-muted-foreground", soft: "bg-muted", solid: "bg-faint", border: "border-border-strong" },
  info: { text: "text-info-fg", soft: "bg-info/12", solid: "bg-info", border: "border-info/30" },
  warning: { text: "text-warning-fg", soft: "bg-warning/12", solid: "bg-warning", border: "border-warning/30" },
  success: { text: "text-success-fg", soft: "bg-success/12", solid: "bg-success", border: "border-success/30" },
  running: { text: "text-running-fg", soft: "bg-running/14", solid: "bg-running", border: "border-running/30" },
  danger: { text: "text-danger-fg", soft: "bg-danger/12", solid: "bg-danger", border: "border-danger/30" },
  brand: { text: "text-brand-text", soft: "bg-brand/12", solid: "bg-brand", border: "border-brand/30" },
  warehouse: { text: "text-stage-warehouse", soft: "bg-stage-warehouse/14", solid: "bg-stage-warehouse", border: "border-stage-warehouse/30" },
  sorting: { text: "text-stage-sorting", soft: "bg-stage-sorting/14", solid: "bg-stage-sorting", border: "border-stage-sorting/30" },
  decolorization: { text: "text-stage-decolorization", soft: "bg-stage-decolorization/14", solid: "bg-stage-decolorization", border: "border-stage-decolorization/30" },
  drying: { text: "text-stage-drying", soft: "bg-stage-drying/14", solid: "bg-stage-drying", border: "border-stage-drying/30" },
  sales: { text: "text-stage-sales", soft: "bg-stage-sales/14", solid: "bg-stage-sales", border: "border-stage-sales/30" },
  procurement: { text: "text-stage-procurement", soft: "bg-stage-procurement/14", solid: "bg-stage-procurement", border: "border-stage-procurement/30" },
  quality: { text: "text-stage-quality", soft: "bg-stage-quality/14", solid: "bg-stage-quality", border: "border-stage-quality/30" },
  production: { text: "text-stage-production", soft: "bg-stage-production/14", solid: "bg-stage-production", border: "border-stage-production/30" },
  finance: { text: "text-stage-finance", soft: "bg-stage-finance/14", solid: "bg-stage-finance", border: "border-stage-finance/30" },
  maintenance: { text: "text-stage-maintenance", soft: "bg-stage-maintenance/14", solid: "bg-stage-maintenance", border: "border-stage-maintenance/30" },
  sustainability: { text: "text-stage-sustainability", soft: "bg-stage-sustainability/14", solid: "bg-stage-sustainability", border: "border-stage-sustainability/30" },
  workforce: { text: "text-stage-workforce", soft: "bg-stage-workforce/14", solid: "bg-stage-workforce", border: "border-stage-workforce/30" },
  documents: { text: "text-stage-documents", soft: "bg-stage-documents/14", solid: "bg-stage-documents", border: "border-stage-documents/30" },
}

/** CSS colour for charts and SVG (same palette as the classes above). */
export const TONE_VAR: Record<Tone, string> = {
  neutral: "var(--faint)",
  info: "var(--info)",
  warning: "var(--warning)",
  success: "var(--success)",
  running: "var(--running)",
  danger: "var(--danger)",
  brand: "var(--brand)",
  warehouse: "var(--stage-warehouse)",
  sorting: "var(--stage-sorting)",
  decolorization: "var(--stage-decolorization)",
  drying: "var(--stage-drying)",
  sales: "var(--stage-sales)",
  procurement: "var(--stage-procurement)",
  quality: "var(--stage-quality)",
  production: "var(--stage-production)",
  finance: "var(--stage-finance)",
  maintenance: "var(--stage-maintenance)",
  sustainability: "var(--stage-sustainability)",
  workforce: "var(--stage-workforce)",
  documents: "var(--stage-documents)",
}
