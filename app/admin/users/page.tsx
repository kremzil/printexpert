import { Suspense } from "react"

import { requireAdmin } from "@/lib/auth-helpers"
import { getPrisma } from "@/lib/prisma"
import { UserRole } from "@/lib/generated/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserRoleToggle } from "./user-role-toggle"

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-8">
          <div className="mb-6 space-y-2">
            <div className="h-7 w-40 rounded bg-muted" />
            <div className="h-4 w-72 rounded bg-muted" />
          </div>
          <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
            Načítavame používateľov…
          </div>
        </div>
      }
    >
      <UsersContent />
    </Suspense>
  )
}

async function UsersContent() {
  await requireAdmin()

  const prisma = getPrisma()
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      _count: {
        select: {
          sessions: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Používatelia</h1>
        <p className="text-muted-foreground mt-2">
          Správa používateľov a prístupových práv
        </p>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl">
                    {user.name || user.email}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {user.email}
                    {user.name && (
                      <span className="text-xs text-muted-foreground ml-2">
                        • {user.email}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant={user.role === UserRole.ADMIN ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                  {user.emailVerified && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Overený
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    Registrácia: {new Date(user.createdAt).toLocaleDateString("sk-SK")}
                  </p>
                  <p>
                    Aktívnych relácií: {user._count.sessions}
                  </p>
                </div>
                <UserRoleToggle userId={user.id} currentRole={user.role} />
              </div>
            </CardContent>
          </Card>
        ))}

        {users.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Zatiaľ nie sú žiadni používatelia
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
