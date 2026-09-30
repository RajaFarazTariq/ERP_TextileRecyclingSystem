"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { BrandMark } from "@/components/layout/brand-mark"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { errorMessage } from "@/lib/api"

const schema = z.object({
  username: z.string().trim().min(1, "Enter your username or email."),
  password: z.string().min(1, "Enter your password."),
})
type Values = z.infer<typeof schema>

/** Only allow redirects back into this app (no open redirects). */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/"
}

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState("")
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "" } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError("")
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setServerError(
        res.status === 429
          ? "Too many sign-in attempts. Please wait a minute and try again."
          : errorMessage(body, "Could not sign in."),
      )
      return
    }
    router.replace(safeNext(params.get("next")))
    router.refresh()
  })

  return (
    <div className="surface w-full max-w-[400px] animate-rise rounded-2xl p-7 sm:p-8">
      <div className="mb-7 space-y-3">
        <BrandMark className="size-11 lg:hidden" />
        <h2 className="font-heading text-2xl font-bold tracking-tight">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Sign in with your username or email</p>
      </div>
      <div>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {serverError && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger-fg">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {serverError}
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="username">Username or email</Label>
            <Input id="username" autoComplete="username" autoFocus className="h-10" aria-invalid={!!errors.username} {...form.register("username")} />
            {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                className="h-10 pr-10"
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Sign in
          </Button>
        </form>
      </div>
    </div>
  )
}
