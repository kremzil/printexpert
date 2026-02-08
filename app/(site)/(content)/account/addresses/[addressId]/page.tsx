import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { resolveAudienceContext } from "@/lib/audience-context"
import { getPrisma } from "@/lib/prisma"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { updateAddress } from "../actions"

const countries = [
  { value: "SK", label: "Slovensko" },
  { value: "CZ", label: "Česká republika" },
  { value: "AT", label: "Rakúsko" },
  { value: "HU", label: "Maďarsko" },
  { value: "PL", label: "Poľsko" },
]

interface EditAddressPageProps {
  params: Promise<{ addressId: string }>
}

export default async function EditAddressPage({ params }: EditAddressPageProps) {
  const [session, audienceContext] = await Promise.all([
    auth(),
    resolveAudienceContext(),
  ])

  if (!session?.user?.id) {
    redirect("/auth")
  }

  const { addressId } = await params

  const prisma = getPrisma()
  const address = await prisma.userAddress.findFirst({
    where: { id: addressId, userId: session.user.id },
  })

  if (!address) {
    notFound()
  }

  const modeColor =
    audienceContext.mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upraviť adresu</h1>
        <p className="text-muted-foreground">
          Upravte údaje adresy doručenia
        </p>
      </div>

      <Card className="p-6">
        <form action={updateAddress} className="space-y-4">
          <input type="hidden" name="id" value={address.id} />

          <div className="space-y-2">
            <Label htmlFor="label">Názov adresy</Label>
            <Input
              id="label"
              name="label"
              required
              defaultValue={address.label}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="street">Ulica a číslo</Label>
            <Input
              id="street"
              name="street"
              required
              defaultValue={address.street}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apt">Apartmán / byt (voliteľné)</Label>
            <Input
              id="apt"
              name="apt"
              defaultValue={address.apt ?? ""}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="city">Mesto</Label>
              <Input id="city" name="city" required defaultValue={address.city} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">PSČ</Label>
              <Input
                id="zipCode"
                name="zipCode"
                required
                defaultValue={address.zipCode}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Krajina</Label>
            <select
              id="country"
              name="country"
              defaultValue={address.country}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {countries.map((country) => (
                <option key={country.value} value={country.value}>
                  {country.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={address.isDefault}
              className="h-4 w-4 rounded border border-input text-primary"
            />
            Nastaviť ako predvolenú
          </label>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button
              type="submit"
              className="px-6 text-white"
              style={{ backgroundColor: modeColor }}
            >
              Uložiť zmeny
            </Button>
            <Link
              href="/account/addresses"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Zrušiť
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
