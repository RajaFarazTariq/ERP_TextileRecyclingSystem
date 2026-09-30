import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { COOKIE, parseUserCookie } from "@/lib/server/session"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const store = await cookies()
  const user = parseUserCookie(store.get(COOKIE.user)?.value)
  if (!user) redirect("/login")
  const sidebarOpen = store.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar user={user} />
      <SidebarInset>
        <AppHeader user={user} />
        <div className="page-glow flex-1 px-4 py-6 md:px-8 md:py-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
