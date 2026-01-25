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
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

export function AccountSidebar() {
  const pathname = usePathname()

  const handleLogout = () => {
    signOut({ callbackUrl: "/" })
  }

  return (
    <aside className="w-64 border-r bg-muted/40">
      <div className="flex h-full flex-col">
        <div className="border-b p-6">
          <h2 className="text-lg font-semibold">Používateľ</h2>
          <p className="text-sm text-muted-foreground">Môj účet</p>
        </div>
        
        <nav className="flex-1 space-y-1 p-4">
          <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Navigácia
          </div>
          {menuItems.map((item) => {
            const isActive = pathname === item.url
            const Icon = item.icon
            return (
              <Link
                key={item.title}
                href={item.url}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            <span>Odhlásiť sa</span>
          </Button>
        </div>
      </div>
    </aside>
  )
}
