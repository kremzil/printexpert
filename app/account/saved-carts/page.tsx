import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getPrisma } from "@/lib/prisma"
import { resolveAudienceContext } from "@/lib/audience-context"
import { Card } from "@/components/ui/card"

export const metadata = {
  title: "Uložené košíky",
  description: "Uložené košíky pre B2B zákazníkov",
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(value)

const formatDate = (value: Date) =>
  value.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

export default async function SavedCartsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth")
  }

  const audienceContext = await resolveAudienceContext()
  if (audienceContext.mode !== "b2b") {
    redirect("/account")
  }

  const prisma = getPrisma()
  const savedCarts = await prisma.savedCart.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          product: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Uložené košíky</h2>
        <p className="text-sm text-muted-foreground">
          Zoznam košíkov, ktoré ste si uložili pre opakované objednávky.
        </p>
      </div>

      {savedCarts.length === 0 ? (
        <Card className="rounded-xl border border-dashed p-6 text-center">
          <div className="text-sm text-muted-foreground">
            Zatiaľ nemáte uložené žiadne košíky.
          </div>
          <div className="mt-3">
            <Link
              href="/catalog"
              className="text-sm font-medium underline"
            >
              Prejsť do katalógu produktov
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {savedCarts.map((cart) => {
            const totals = cart.items.reduce(
              (acc, item) => {
                const snapshot = item.priceSnapshot as
                  | { net?: number; vatAmount?: number; gross?: number }
                  | null
                if (snapshot && typeof snapshot === "object") {
                  const net = Number(snapshot.net ?? 0)
                  const vat = Number(snapshot.vatAmount ?? 0)
                  const gross = Number(snapshot.gross ?? 0)
                  acc.net += net * item.quantity
                  acc.vat += vat * item.quantity
                  acc.gross += gross * item.quantity
                } else {
                  acc.missing += 1
                }
                return acc
              },
              { net: 0, vat: 0, gross: 0, missing: 0 }
            )

            const totalQuantity = cart.items.reduce(
              (sum, item) => sum + item.quantity,
              0
            )

            return (
              <Card key={cart.id} className="rounded-xl p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="text-lg font-semibold">
                      {cart.name?.trim() || "Uložený košík"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Uložené: {formatDate(cart.createdAt)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {cart.items.length}{" "}
                      {cart.items.length === 1
                        ? "položka"
                        : cart.items.length < 5
                          ? "položky"
                          : "položiek"}{" "}
                      • {totalQuantity} ks spolu
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {totals.gross > 0 ? (
                      <div className="space-y-1">
                        <div>
                          Celkom bez DPH:{" "}
                          <span className="font-semibold text-foreground">
                            {formatMoney(totals.net)}
                          </span>
                        </div>
                        <div>
                          DPH:{" "}
                          <span className="font-semibold text-foreground">
                            {formatMoney(totals.vat)}
                          </span>
                        </div>
                        <div>
                          Celkom s DPH:{" "}
                          <span className="font-semibold text-foreground">
                            {formatMoney(totals.gross)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>Cena na dopyt</div>
                    )}
                    {totals.missing > 0 ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Niektoré položky nemajú dostupnú cenu.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t pt-4">
                  {cart.items.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/product/${item.product.slug}`}
                          className="block truncate font-medium hover:underline"
                        >
                          {item.product.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          Množstvo: {item.quantity} ks
                        </div>
                      </div>
                    </div>
                  ))}
                  {cart.items.length > 3 ? (
                    <div className="text-xs text-muted-foreground">
                      + ďalšie {cart.items.length - 3} položky
                    </div>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
