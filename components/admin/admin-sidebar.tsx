"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Sliders,
  Users,
  Home,
  Settings,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from "lucide-react"

const menuItems = [
  {
    id: "home",
    title: "Domov",
    url: "/",
    icon: Home,
  },
  {
    id: "dashboard",
    title: "Prehľad",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    id: "products",
    title: "Produkty",
    icon: Package,
    children: [
      {
        id: "all-products",
        title: "Všetky produkty",
        url: "/admin/products",
      },
      {
        id: "top-products",
        title: "Top produkty",
        url: "/admin/top-products",
      },
    ],
  },
  {
    id: "categories",
    title: "Kategórie",
    url: "/admin/kategorie",
    icon: FolderTree,
  },
  {
    id: "orders",
    title: "Objednávky",
    url: "/admin/orders",
    icon: ShoppingCart,
  },
  {
    id: "attributes",
    title: "Vlastnosti",
    url: "/admin/vlastnosti",
    icon: Sliders,
  },
  {
    id: "users",
    title: "Používatelia",
    url: "/admin/users",
    icon: Users,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>(["products"])

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const renderItem = (item: typeof menuItems[0], level = 0) => {
    const isExpanded = expandedItems.includes(item.id)
    const isActive = pathname === item.url
    const hasChildren = item.children && item.children.length > 0
    const hasActiveChild = item.children?.some((child) => pathname === child.url)

    return (
      <div key={item.id}>
        <button
          onClick={() => {
            if (hasChildren) {
              toggleExpand(item.id)
            } else if (item.url) {
              window.location.href = item.url
            }
          }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            isActive || hasActiveChild
              ? "bg-gray-900 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
          <span className="flex-1 text-left">{item.title}</span>
          {hasChildren &&
            (isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            ))}
        </button>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {item.children!.map((child) => {
              const childActive = pathname === child.url
              return (
                <Link
                  key={child.id}
                  href={child.url}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    childActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  style={{ paddingLeft: `${12 + (level + 1) * 16}px` }}
                >
                  <span className="flex-1 text-left">{child.title}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="border-b border-border bg-white p-4">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-900 text-sm font-bold text-white">
            P
          </div>
          <div className="text-sm font-bold text-foreground">PrintExpert Admin</div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
          Navigácia
        </div>
        <div className="space-y-1">{menuItems.map((item) => renderItem(item))}</div>
      </div>

      {/* Settings at bottom */}
      <div className="border-t border-border bg-white p-3">
        <Link
          href="/admin/settings"
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname === "/admin/settings"
              ? "bg-gray-900 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Nastavenia</span>
        </Link>
      </div>

      {/* Version */}
      <div className="border-t border-border bg-white p-4">
        <div className="text-xs text-muted-foreground">Version 2.0.0</div>
      </div>
    </div>
  )
}
