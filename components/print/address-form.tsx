"use client"

import type { CustomerMode } from "@/components/print/types"
import { Card } from "@/components/ui/card"

interface AddressFormProps {
  mode: CustomerMode
  title: string
  showCompanyFields?: boolean
  values: {
    companyName?: string
    ico?: string
    dic?: string
    icDph?: string
    firstName: string
    lastName: string
    email: string
    phone: string
    street: string
    apt?: string
    city: string
    zipCode: string
    country: string
  }
  onChange: (field: string, value: string) => void
}

export function AddressForm({
  mode,
  title,
  showCompanyFields,
  values,
  onChange,
}: AddressFormProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"

  return (
    <Card className="p-6">
      <h3 className="mb-4 text-lg font-semibold" style={{ color: modeColor }}>
        {title}
      </h3>

      <div className="space-y-4">
        {showCompanyFields && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Názov spoločnosti <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={values.companyName || ""}
                onChange={(event) => onChange("companyName", event.target.value)}
                placeholder="Printexpert s.r.o."
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  IČO <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={values.ico || ""}
                  onChange={(event) => onChange("ico", event.target.value)}
                  placeholder="12345678"
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  DIČ <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={values.dic || ""}
                  onChange={(event) => onChange("dic", event.target.value)}
                  placeholder="1234567890"
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">IČ DPH</label>
                <input
                  type="text"
                  value={values.icDph || ""}
                  onChange={(event) => onChange("icDph", event.target.value)}
                  placeholder="SK1234567890"
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="mb-3 text-sm font-semibold">Kontaktná osoba</h4>
            </div>
          </>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Meno <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={values.firstName}
              onChange={(event) => onChange("firstName", event.target.value)}
              placeholder="Ján"
              className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Priezvisko <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={values.lastName}
              onChange={(event) => onChange("lastName", event.target.value)}
              placeholder="Novák"
              className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              value={values.email}
              onChange={(event) => onChange("email", event.target.value)}
              placeholder="jan.novak@email.sk"
              className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Telefón <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              value={values.phone}
              onChange={(event) => onChange("phone", event.target.value)}
              placeholder="+421 900 123 456"
              className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Ulica a číslo <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={values.street}
            onChange={(event) => onChange("street", event.target.value)}
            placeholder="Hlavná 123"
            className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Apartmán / byt
          </label>
          <input
            type="text"
            value={values.apt || ""}
            onChange={(event) => onChange("apt", event.target.value)}
            placeholder="12B"
            className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">
              Mesto <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={values.city}
              onChange={(event) => onChange("city", event.target.value)}
              placeholder="Bratislava"
              className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              PSČ <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={values.zipCode}
              onChange={(event) => onChange("zipCode", event.target.value)}
              placeholder="81101"
              className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Krajina <span className="text-red-600">*</span>
          </label>
          <select
            value={values.country}
            onChange={(event) => onChange("country", event.target.value)}
            className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            required
          >
            <option value="SK">Slovensko</option>
            <option value="CZ">Česká republika</option>
            <option value="AT">Rakúsko</option>
            <option value="HU">Maďarsko</option>
            <option value="PL">Poľsko</option>
          </select>
        </div>
      </div>
    </Card>
  )
}
