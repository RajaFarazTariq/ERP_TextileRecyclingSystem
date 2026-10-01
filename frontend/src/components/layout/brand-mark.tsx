import { Recycle } from "lucide-react"

import { cn } from "@/lib/utils"

/** The product's logo: a recycle mark on the brand gradient. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("brand-gradient flex size-9 shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_6px_16px_-6px_var(--brand)]", className)}>
      <Recycle className="size-[55%]" strokeWidth={2.4} aria-hidden />
    </span>
  )
}
