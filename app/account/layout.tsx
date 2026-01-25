"use client"

import { ReactNode } from "react"

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AccountSidebar } from "@/components/account/account-sidebar"

type AccountLayoutProps = {
  children: ReactNode
  userName?: string | null
  userEmail?: string
}

export default function AccountLayout({
  children,
}: {
  children: ReactNode
}) {
  // Session data будет получена на верхнем уровне и передана через контекст
  return (
    <SidebarProvider>
      <AccountSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Môj účet</h1>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
