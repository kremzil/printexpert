import type { Metadata } from "next"
import { ReactNode } from "react"
import { AccountMenu } from "@/components/account/account-menu"
import { AccountSidebar } from "@/components/account/account-sidebar"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { resolveAudienceContext } from "@/lib/audience-context"
import { auth } from "@/auth"
import { getPrisma } from "@/lib/prisma"
import { mergeGuestCart } from "@/lib/cart"
import { cookies } from "next/headers"
import { NOINDEX_ROBOTS } from "@/lib/seo"

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
}

export default async function AccountLayout({
  children,
}: {
  children: ReactNode
}) {
  const audienceContext = await resolveAudienceContext()
  const session = await auth()
  const cookieStore = await cookies()
  const guestSessionId = cookieStore.get("cart_session_id")?.value

  if (session?.user?.id && guestSessionId) {
    await mergeGuestCart(guestSessionId, session.user.id)
  }

  const prisma = getPrisma()
  const orderCount = session?.user?.id
    ? await prisma.order.count({ where: { userId: session.user.id } })
    : 0
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true },
      })
    : null
  const userName = user?.name ?? session?.user?.name ?? null
  const userEmail = user?.email ?? session?.user?.email ?? null

  return (
    <>
      {/* Mobile: Sidebar */}
      <div className="lg:hidden">
        <SidebarProvider>
          <AccountSidebar
            mode={audienceContext.mode}
            userName={userName}
            userEmail={userEmail}
            orderCount={orderCount}
          />
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <SidebarTrigger className="-ml-1" />
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Osobný účet</span>
              </div>
            </header>
            <main className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </div>

      {/* Desktop: Scroll menu */}
      <div className="hidden lg:block w-full">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
             <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
            <aside className="h-full">
              <div className="sticky top-20">
              <AccountMenu
                mode={audienceContext.mode}
                userName={userName}
                userEmail={userEmail}
                orderCount={orderCount}
              />
              </div>
            </aside>
            <main>
              {children}
            </main>
          </div>
        </div>
      </div>
    </>
  )
}
