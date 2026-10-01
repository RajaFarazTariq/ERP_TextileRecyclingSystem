import { ChevronRight } from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"

import { BrandMark } from "@/components/layout/brand-mark"
import { NavIcon } from "@/components/layout/nav-icon"
import type { NavIcon as NavIconName } from "@/config/access"
import { LoginForm } from "@/features/auth/login-form"
import { TONE, type StageTone } from "@/lib/tones"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Sign in" }

const FLOW: { label: string; tone: StageTone; icon: NavIconName }[] = [
  { label: "Warehouse", tone: "warehouse", icon: "warehouse" },
  { label: "Sorting", tone: "sorting", icon: "sorting" },
  { label: "Decolorization", tone: "decolorization", icon: "decolorization" },
  { label: "Drying", tone: "drying", icon: "drying" },
  { label: "Sales", tone: "sales", icon: "sales" },
]

export default function LoginPage() {
  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r bg-sidebar p-10 lg:flex lg:flex-col" aria-label="About Textile ERP">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(40rem_28rem_at_20%_10%,var(--glow),transparent_70%),radial-gradient(30rem_24rem_at_90%_90%,color-mix(in_oklab,var(--brand-2)_12%,transparent),transparent_70%)]" />
        <div aria-hidden className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />

        <div className="relative flex items-center gap-3">
          <BrandMark className="size-10" />
          <div className="leading-tight">
            <p className="font-heading text-lg font-bold tracking-tight">Textile ERP</p>
            <p className="text-xs text-muted-foreground">Recycling operations</p>
          </div>
        </div>

        <div className="relative my-auto max-w-xl space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-widest text-brand-text uppercase">From waste fabric to sellable stock</p>
            <h1 className="font-heading text-4xl leading-tight font-bold tracking-tight">
              Every kilogram, <span className="brand-gradient-text">tracked through the line.</span>
            </h1>
            <p className="text-muted-foreground">
              Receive deliveries, sort, decolorize and dry, then sell what&apos;s ready, with live stock and a full audit trail.
            </p>
          </div>
          <ol className="flex flex-wrap items-center gap-1.5">
            {FLOW.map((s, i) => (
              <li key={s.label} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="size-3.5 text-faint" aria-hidden />}
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-card/70 px-2.5 py-1 text-xs font-medium backdrop-blur", TONE[s.tone].border)}>
                  <NavIcon name={s.icon} className={cn("size-3.5", TONE[s.tone].text)} />
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative text-xs text-faint">Access is limited to your role. Ask an administrator if you need another module.</p>
      </section>

      <section className="page-glow flex items-center justify-center p-4 sm:p-8">
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  )
}
