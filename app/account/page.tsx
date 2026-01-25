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
        <h2 className="text-2xl font-semibold">Prehľad účtu</h2>
        <p className="text-sm text-muted-foreground">
          Základné údaje a nastavenia vášho účtu.
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
