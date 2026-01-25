"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  User,
  Home,
  ShoppingCart,
  Settings,
  LogOut,
} from "lucide-react"
import { signOut } from "next-auth/react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"

const menuItems = [
  {
    title: "Domov",
    url: "/",
    icon: Home,
  },
  {
    title: "Môj účet",
    url: "/account",
    icon: User,
  },
  {
    title: "Objednávky",
    url: "/account/orders",
    icon: ShoppingCart,
  },
  {
    title: "Nastavenia",
    url: "/account/settings",
    icon: Settings,
  },
]

type AccountSidebarProps = {
  userName?: string | null
  userEmail?: string
}

export function AccountSidebar({ userName, userEmail }: AccountSidebarProps = {}) {
  const pathname = usePathname()

  const handleLogout = () => {
    signOut({ callbackUrl: "/" })
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-4 py-2">
          <h2 className="text-lg font-semibold">
            Používateľ
          </h2>
          <p className="text-xs text-muted-foreground truncate">
            Môj účet
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigácia</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut />
              <span>Odhlásiť sa</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
