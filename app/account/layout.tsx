import { ReactNode, Suspense } from "react"
import { AccountSidebar } from "@/components/account/account-sidebar"
import { Skeleton } from "@/components/ui/skeleton"

export default function AccountLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <Suspense fallback={<Skeleton className="w-64 h-full" />}>
        <AccountSidebar />
      </Suspense>
      <div className="flex-1">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-semibold">Môj účet</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
