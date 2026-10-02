"use client"

import { ChevronsUpDown, LogOut, Monitor, Moon, Sun } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"

import { InitialsAvatar } from "@/components/common/identity"
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { ROLE_LABELS, navFor } from "@/config/access"
import { NAV_TONES } from "@/config/nav-tones"
import { logout } from "@/features/auth/use-session"
import { displayName } from "@/lib/format"
import { TONE } from "@/lib/tones"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/types/api"
import { BrandMark } from "./brand-mark"
import { NavIcon } from "./nav-icon"
import { useNavCounts } from "./use-nav-counts"

function UserCard({ user }: { user: SessionUser }) {
  const { theme, setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="User menu"
          className="flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2 text-left transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0.5"
        >
          <InitialsAvatar name={user.username} size="md" className="ring-2 ring-sidebar" />
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold">{displayName(user.username)}</span>
            <span className="block truncate text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="font-medium">{displayName(user.username)}</p>
          <p className="text-xs text-muted-foreground">{user.email || ROLE_LABELS[user.role]}</p>
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
          <LogOut className="size-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname()
  const counts = useNavCounts(user.role)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 pt-4 pb-2 group-data-[collapsible=icon]:px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/" className="flex items-center gap-3 rounded-xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:p-0" aria-label="Textile ERP home">
              <BrandMark className="group-data-[collapsible=icon]:size-8" />
              <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-heading text-[15px] font-bold tracking-tight">Textile ERP</span>
                <span className="truncate text-xs text-muted-foreground">Recycling operations</span>
              </span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin px-1.5">
        {navFor(user.role).map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[11px] font-semibold tracking-wider text-faint uppercase">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const active = pathname.startsWith(item.href)
                  const count = counts[item.icon]
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={active}
                        className="relative h-9 rounded-lg px-2.5 text-[13.5px] font-medium text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/70 data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground"
                      >
                        <Link href={item.href}>
                          {active && <span aria-hidden className="brand-gradient absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full" />}
                          <NavIcon name={item.icon} className={cn("size-4", TONE[NAV_TONES[item.icon]].text)} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {count && (
                        <SidebarMenuBadge
                          title={count.label}
                          aria-label={count.label}
                          className={cn("top-2! rounded-full px-1.5 text-[11px] font-semibold", TONE[NAV_TONES[item.icon]].soft, TONE[NAV_TONES[item.icon]].text)}
                        >
                          {count.count}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        <UserCard user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
