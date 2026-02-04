import Link from "next/link"
import { redirect } from "next/navigation"
import { MapPin, Plus, Pencil, Trash2, Check } from "lucide-react"

import { auth } from "@/auth"
import { getPrisma } from "@/lib/prisma"
import { resolveAudienceContext } from "@/lib/audience-context"
import { cn } from "@/lib/utils"
import { deleteAddress, setDefaultAddress } from "./actions"

const countryLabels: Record<string, string> = {
  SK: "Slovensko",
  CZ: "Česká republika",
  AT: "Rakúsko",
  HU: "Maďarsko",
  PL: "Poľsko",
}

export default async function AccountAddressesPage() {
  const [session, audienceContext] = await Promise.all([
    auth(),
    resolveAudienceContext(),
  ])

  if (!session?.user?.id) {
    redirect("/auth")
  }

  const prisma = getPrisma()
  const addresses = await prisma.userAddress.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  })

  const modeColor =
    audienceContext.mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent =
    audienceContext.mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Adresy</h1>
          <p className="text-muted-foreground">
            Spravujte adresy dodania pre vašu firmu
          </p>
        </div>
        <Link
          href="/account/addresses/new"
          className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: modeColor }}
        >
          <Plus className="h-4 w-4" />
          Pridať adresu
        </Link>
      </div>

      {addresses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => {
            const countryLabel =
              countryLabels[address.country] ?? address.country

            return (
              <div
                key={address.id}
                className={cn(
                  "relative rounded-[14px] border bg-white p-6 shadow-sm",
                  address.isDefault ? "border-2" : "border-border"
                )}
                style={
                  address.isDefault ? { borderColor: modeColor } : undefined
                }
              >
                {address.isDefault && (
                  <div
                    className="absolute right-0 top-0 rounded-bl-[10px] px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: modeColor }}
                  >
                    Predvolená
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-[10px]"
                    style={{ backgroundColor: modeAccent }}
                  >
                    <MapPin className="h-5 w-5" style={{ color: modeColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-foreground">
                      {address.label}
                    </h3>
                    <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                      <div>{address.street}</div>
                      {address.apt && <div>Apartmán / byt: {address.apt}</div>}
                      <div>
                        {address.zipCode} {address.city}
                      </div>
                      <div>{countryLabel}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {!address.isDefault && (
                    <form action={setDefaultAddress} className="flex-1 min-w-[180px]">
                      <input type="hidden" name="id" value={address.id} />
                      <button
                        type="submit"
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border-2 px-3 text-sm font-medium transition-colors hover:bg-muted/40"
                        style={{ borderColor: modeColor, color: modeColor }}
                      >
                        <Check className="h-4 w-4" />
                        Nastaviť ako predvolenú
                      </button>
                    </form>
                  )}

                  <Link
                    href={`/account/addresses/${address.id}`}
                    className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border text-foreground transition-colors hover:bg-muted/40"
                    aria-label="Upraviť adresu"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>

                  <form action={deleteAddress}>
                    <input type="hidden" name="id" value={address.id} />
                    <button
                      type="submit"
                      className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-red-200 text-red-600 transition-colors hover:bg-red-50"
                      aria-label="Odstrániť adresu"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
