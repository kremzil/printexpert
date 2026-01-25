"use client"

import { ReactNode } from "react"

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin/admin-sidebar"

export default function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Administrácia</h1>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
