"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  User,
  Home,
  Settings,
  LogOut,
  Package,
  MapPin,
  Save,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { ModeButton } from "@/components/print/mode-button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

function NavigationItems({
  pathname,
  mode,
  orderCount,
}: {
  pathname: string
  mode: "b2c" | "b2b"
  orderCount?: number
}) {
  const modeColor = mode === 'b2c' ? 'var(--b2c-primary)' : 'var(--b2b-primary)'
  const modeAccent = mode === 'b2c' ? 'var(--b2c-accent)' : 'var(--b2b-accent)'
  
  const menuItems = [
    {
      title: "Domov",
      url: "/",
      icon: Home,
    },
    {
      title: "Prehľad",
      url: "/account",
      icon: User,
    },
    {
      title: "Objednávky",
      url: "/account/orders",
      icon: Package,
    },
    ...(mode === "b2b"
      ? [
          {
            title: "Uložené košíky",
            url: "/account/saved-carts",
            icon: Save,
          },
        ]
      : []),
    {
      title: "Adresy",
      url: "/account/addresses",
      icon: MapPin,
    },
    {
      title: "Nastavenia",
      url: "/account/settings",
      icon: Settings,
    },
  ]

  return (
    <>
      <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Navigácia
      </div>
      {menuItems.map((item) => {
        const isActive = pathname === item.url
        const Icon = item.icon
        const badge = item.title === "Objednávky" ? orderCount : undefined
        return (
          <SidebarMenuItem key={item.title}>
            <Link
              href={item.url}
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left font-medium transition-all"
              style={{
                backgroundColor: isActive ? modeAccent : 'transparent',
                color: isActive ? modeColor : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5" />
                <span>{item.title}</span>
              </div>
              {badge && badge > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: isActive ? modeColor : 'var(--muted)',
                    color: isActive ? 'white' : 'var(--muted-foreground)',
                  }}
                >
                  {badge}
                </span>
              )}
            </Link>
          </SidebarMenuItem>
        )
      })}
    </>
  )
}

export function AccountSidebar({
  mode,
  userName,
  userEmail,
  orderCount,
}: {
  mode: "b2c" | "b2b"
  userName?: string | null
  userEmail?: string | null
  orderCount?: number
}) {
  const pathname = usePathname()
  const displayName = userName || userEmail || "Používateľ"

  const handleLogout = () => {
    signOut({ callbackUrl: "/" })
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4 lg:p-6">
        <div>
          <h2 className="text-lg font-semibold">{displayName}</h2>
          <p className="text-sm text-muted-foreground">Môj účet</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="space-y-1 p-4">
          <NavigationItems pathname={pathname} mode={mode} orderCount={orderCount} />
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <ModeButton mode={mode} variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          <span>Odhlásiť sa</span>
        </ModeButton>
      </SidebarFooter>
    </Sidebar>
  )
}
