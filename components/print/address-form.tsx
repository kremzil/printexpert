"use client"

import type { CustomerMode } from "@/components/print/types"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AddressFormProps {
  mode: CustomerMode
  title: string
  showCompanyFields?: boolean
  invalidFields?: Set<string>
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

const baseInputClass =
  "w-full rounded-lg bg-input-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
const validBorder = "border border-border"
const invalidBorder = "border border-destructive ring-1 ring-destructive/30"

export function AddressForm({
  mode,
  title,
  showCompanyFields,
  invalidFields,
  values,
  onChange,
}: AddressFormProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const isInvalid = (field: string) => invalidFields?.has(field) ?? false

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
                className={cn(baseInputClass, isInvalid("companyName") ? invalidBorder : validBorder)}
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
                  className={cn(baseInputClass, isInvalid("ico") ? invalidBorder : validBorder)}
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
                  className={cn(baseInputClass, isInvalid("dic") ? invalidBorder : validBorder)}
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
                  className={cn(baseInputClass, validBorder)}
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
              className={cn(baseInputClass, isInvalid("firstName") ? invalidBorder : validBorder)}
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
              className={cn(baseInputClass, isInvalid("lastName") ? invalidBorder : validBorder)}
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
              className={cn(baseInputClass, isInvalid("email") ? invalidBorder : validBorder)}
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
              className={cn(baseInputClass, isInvalid("phone") ? invalidBorder : validBorder)}
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
            className={cn(baseInputClass, isInvalid("street") ? invalidBorder : validBorder)}
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
            className={cn(baseInputClass, validBorder)}
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
              className={cn(baseInputClass, isInvalid("city") ? invalidBorder : validBorder)}
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
              className={cn(baseInputClass, isInvalid("zipCode") ? invalidBorder : validBorder)}
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
            className={cn(baseInputClass, isInvalid("country") ? invalidBorder : validBorder)}
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
