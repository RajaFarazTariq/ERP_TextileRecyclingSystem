"use client"

import { LogOut, Monitor, Moon, Sun } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Fragment } from "react"

import { InitialsAvatar } from "@/components/common/identity"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { NAV, ROLE_LABELS } from "@/config/access"
import { logout } from "@/features/auth/use-session"
import { displayName } from "@/lib/format"
import type { SessionUser } from "@/types/api"
import { CommandMenu } from "./command-menu"
import { Notifications } from "./notifications"
import { ThemeToggle } from "./theme-toggle"

// Pages are named as in the menu ("/procurement" is "Purchasing")
const NAV_TITLES = new Map(NAV.flatMap((g) => g.items.map((i) => [i.href.slice(1), i.title] as const)))

function titleCase(segment: string) {
  return NAV_TITLES.get(segment) ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function Breadcrumbs() {
  const segments = usePathname().split("/").filter(Boolean)
  return (
    <Breadcrumb>
      {/* One line: a long trail shortens with "…" instead of wrapping under the header */}
      <BreadcrumbList className="flex-nowrap whitespace-nowrap">
        <BreadcrumbItem>
          {segments.length ? (
            <BreadcrumbLink asChild><Link href="/">Home</Link></BreadcrumbLink>
          ) : (
            <BreadcrumbPage>Home</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {segments.map((segment, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/")
          const last = i === segments.length - 1
          return (
            <Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className={last ? "min-w-0" : undefined}>
                {last ? (
                  <BreadcrumbPage className="truncate">{titleCase(segment)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild><Link href={href}>{titleCase(segment)}</Link></BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function UserMenu({ user }: { user: SessionUser }) {
  const { theme, setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 rounded-full pr-2.5 pl-1" aria-label="Account menu">
          <InitialsAvatar name={user.username} />
          <span className="hidden text-sm font-medium md:inline">{displayName(user.username)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="font-medium">{displayName(user.username)}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light"><Sun className="size-4" /> Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon className="size-4" /> Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><Monitor className="size-4" /> System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout()}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65 md:px-6">
      <SidebarTrigger className="-ml-1 size-9" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-5 data-vertical:self-center" />
      <div className="hidden min-w-0 flex-1 overflow-hidden sm:block">
        <Breadcrumbs />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <CommandMenu pages={user.pages} />
        <Notifications role={user.role} username={user.username} />
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 hidden data-vertical:h-5 data-vertical:self-center sm:block" />
        <UserMenu user={user} />
      </div>
    </header>
  )
}
