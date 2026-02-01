"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { CustomerMode } from "@/components/print/types"
import { Card } from "@/components/ui/card"
import { User, Mail, Phone, Building2, Hash } from "lucide-react"

export interface ProfileData {
  firstName: string
  lastName: string
  email: string
  phone: string
  companyName?: string
  ico?: string
  dic?: string
  icDph?: string
  position?: string
}

interface ProfileSectionProps {
  mode: CustomerMode
  initialData: ProfileData
  onSave: (data: ProfileData) => Promise<void>
}

export function ProfileSection({ mode, initialData, onSave }: ProfileSectionProps) {
  const [data, setData] = useState<ProfileData>(initialData)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"

  const handleChange = (field: keyof ProfileData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(data)
      setIsEditing(false)
      router.refresh()
    } catch (error) {
      console.error("Failed to save profile:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setData(initialData)
    setIsEditing(false)
  }

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: modeColor }}
            >
              <User className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold">Osobné údaje</h3>
              <p className="text-sm text-muted-foreground">
                {mode === "b2c" ? "Vaše kontaktné informácie" : "Kontaktná osoba"}
              </p>
            </div>
          </div>

          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-lg border-2 px-4 py-2 font-medium transition-all hover:bg-muted"
              style={{ borderColor: modeColor, color: modeColor }}
            >
              Upraviť
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Meno</label>
              <input
                type="text"
                value={data.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                disabled={!isEditing}
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Priezvisko</label>
              <input
                type="text"
                value={data.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                disabled={!isEditing}
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={data.email}
                onChange={(e) => handleChange("email", e.target.value)}
                disabled={!isEditing}
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Telefón</label>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <input
                type="tel"
                value={data.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                disabled={!isEditing}
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-3 border-t border-border pt-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-lg px-4 py-2 font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: modeColor }}
              >
                {isSaving ? "Ukladám..." : "Uložiť zmeny"}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded-lg border-2 border-border px-4 py-2 font-medium transition-all hover:bg-muted disabled:opacity-50"
              >
                Zrušiť
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Company Information for B2B */}
      {mode === "b2b" && (
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: modeColor }}
            >
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold">Firemné údaje</h3>
              <p className="text-sm text-muted-foreground">Informácie o spoločnosti</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Názov spoločnosti</label>
              <input
                type="text"
                value={data.companyName || ""}
                onChange={(e) => handleChange("companyName", e.target.value)}
                disabled={!isEditing}
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">IČO</label>
                <input
                  type="text"
                  value={data.ico || ""}
                  onChange={(e) => handleChange("ico", e.target.value)}
                  disabled={!isEditing}
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">DIČ</label>
                <input
                  type="text"
                  value={data.dic || ""}
                  onChange={(e) => handleChange("dic", e.target.value)}
                  disabled={!isEditing}
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">IČ DPH</label>
                <input
                  type="text"
                  value={data.icDph || ""}
                  onChange={(e) => handleChange("icDph", e.target.value)}
                  disabled={!isEditing}
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Pozícia</label>
              <input
                type="text"
                value={data.position || ""}
                onChange={(e) => handleChange("position", e.target.value)}
                disabled={!isEditing}
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
