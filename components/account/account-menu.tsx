"use client"

import { LogOut } from "lucide-react"
import { signOut } from "next-auth/react"

import { AccountTabs } from "@/components/account/account-tabs"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AccountMenuProps {
  mode: "b2c" | "b2b"
  userName?: string | null
  userEmail?: string | null
  orderCount?: number
}

export function AccountMenu({ mode, userName, userEmail, orderCount }: AccountMenuProps) {
  const displayName = userName || userEmail || "Používateľ"
  const initials = displayName
    ? displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")
    : "U"

  const handleLogout = () => {
    signOut({ callbackUrl: "/" })
  }

  return (
    <ScrollArea className="max-h-[70vh]">
      <div className="space-y-4 p-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold text-white"
              style={{
                backgroundColor: mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground">
                {displayName}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-2">
          <AccountTabs mode={mode} variant="vertical" orderCount={orderCount} />
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 transition-all hover:bg-red-100"
        >
          <LogOut className="h-5 w-5" />
          <span>Odhlásiť sa</span>
        </button>
      </div>
    </ScrollArea>
  )
}
