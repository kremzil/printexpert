"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { Settings, Bell, Search } from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"

export default function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()

  // Get page title based on pathname
  const getPageTitle = () => {
    if (pathname === "/admin") return "Dashboard"
    if (pathname.startsWith("/admin/products")) return "Produkty"
    if (pathname.startsWith("/admin/orders")) return "Objednávky"
    if (pathname.startsWith("/admin/users")) return "Používatelia"
    if (pathname.startsWith("/admin/kategorie")) return "Kategórie"
    if (pathname.startsWith("/admin/vlastnosti")) return "Vlastnosti"
    if (pathname.startsWith("/admin/settings")) return "Nastavenia"
    return "Administrácia"
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-border bg-gray-50">
        <AdminSidebar />
      </aside>

      {/* Main Content */}
      <div className="ml-60 flex-1">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-white shadow-sm">
          <div className="flex h-16 items-center justify-between px-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{getPageTitle()}</h1>
              <p className="text-sm text-muted-foreground">PrintExpert Admin</p>
            </div>
            <div className="flex items-center gap-3">
              <AdminButton variant="ghost" size="sm" icon={Search}>
                Hľadať
              </AdminButton>
              <AdminButton variant="ghost" size="sm" icon={Bell} />
              <Link href="/admin/settings">
                <AdminButton variant="ghost" size="sm" icon={Settings}>
                  Nastavenia
                </AdminButton>
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main>
          {children}
        </main>
      </div>
    </div>
  )
}
