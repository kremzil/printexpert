import { Suspense } from "react"
import { redirect } from "next/navigation"

import { AccountPanel } from "@/app/account/account-panel"
import { auth } from "@/auth"

async function AccountContent() {
  const session = await auth()
  if (!session?.user) {
    redirect("/auth")
  }

  return (
    <AccountPanel
      name={session.user.name}
      email={session.user.email}
      hasPassword={Boolean(session.user.passwordHash)}
    />
  )
}

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Môj účet</h1>
        <p className="text-sm text-muted-foreground">
          Prehľad základných údajov a nastavení.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
            Načítavam účet…
          </div>
        }
      >
        <AccountContent />
      </Suspense>
    </div>
  )
}
