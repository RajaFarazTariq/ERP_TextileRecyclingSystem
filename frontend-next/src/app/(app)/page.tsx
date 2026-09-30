import { ArrowRight, ExternalLink } from "lucide-react"
import { cookies } from "next/headers"
import Link from "next/link"

import { PageHeader } from "@/components/common/page-header"
import { NavIcon } from "@/components/layout/nav-icon"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LEGACY_APP_URL, ROLE_LABELS, navFor } from "@/config/access"
import { COOKIE, parseUserCookie } from "@/lib/server/session"

export default async function HomePage() {
  const user = parseUserCookie((await cookies()).get(COOKIE.user)?.value)!
  const modules = navFor(user.role).flatMap((g) => g.items)

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Welcome, ${user.username}`} description={`Signed in as ${ROLE_LABELS[user.role]}.`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => {
          const content = (
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <NavIcon name={m.icon} className="size-5 text-primary" />
                  {m.migrated ? (
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                  ) : (
                    <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <CardTitle>{m.title}</CardTitle>
                <CardDescription>{m.migrated ? "Open" : "Opens in the classic app (being moved here)"}</CardDescription>
              </CardHeader>
            </Card>
          )
          return m.migrated ? (
            <Link key={m.href} href={m.href}>{content}</Link>
          ) : (
            <a key={m.href} href={`${LEGACY_APP_URL}${m.href}`} target="_blank" rel="noreferrer">{content}</a>
          )
        })}
      </div>
    </div>
  )
}
