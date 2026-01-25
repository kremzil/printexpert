"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Sliders,
  Users,
  Home,
} from "lucide-react"

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
    title: "Prehľad",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Produkty",
    url: "/admin/products",
    icon: Package,
  },
  {
    title: "Kategórie",
    url: "/admin/kategorie",
    icon: FolderTree,
  },
  {
    title: "Vlastnosti",
    url: "/admin/vlastnosti",
    icon: Sliders,
  },
  {
    title: "Používatelia",
    url: "/admin/users",
    icon: Users,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-4 py-2">
          <h2 className="text-lg font-semibold">Administrácia</h2>
          <p className="text-xs text-muted-foreground">
            Správa obsahu
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
        <div className="px-4 py-2 text-xs text-muted-foreground">
          PrintExpert Admin
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
