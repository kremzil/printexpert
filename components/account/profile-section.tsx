"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import type { CustomerMode } from "@/components/print/types"
import { Card } from "@/components/ui/card"
import { User, Mail, Phone, Building2, Lock, Eye, EyeOff } from "lucide-react"
import { getCsrfHeader } from "@/lib/csrf"

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
  hasPassword: boolean
  onSave: (data: ProfileData) => Promise<void>
}

type PasswordData = {
  currentPassword: string
  password: string
  confirmPassword: string
}

export function ProfileSection({ mode, initialData, hasPassword, onSave }: ProfileSectionProps) {
  const [data, setData] = useState<ProfileData>(initialData)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  })
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [isPasswordSet, setIsPasswordSet] = useState(hasPassword)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isResetMailSending, setIsResetMailSending] = useState(false)
  const [resetMailMessage, setResetMailMessage] = useState<string | null>(null)
  const [resetMailError, setResetMailError] = useState<string | null>(null)
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

  const handlePasswordChange = (field: keyof PasswordData, value: string) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }))
    if (passwordError) {
      setPasswordError(null)
    }
    if (passwordSuccess) {
      setPasswordSuccess(null)
    }
  }

  const handleSendResetMail = async () => {
    setResetMailMessage(null)
    setResetMailError(null)
    setIsResetMailSending(true)

    try {
      const response = await fetch("/api/account/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeader(),
        },
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        setResetMailError(
          payload?.error ?? "Nepodarilo sa odoslať e-mail na obnovenie hesla."
        )
        return
      }

      setResetMailMessage("Poslali sme vám e-mail na obnovenie hesla. Skontrolujte si schránku.")
    } catch (error) {
      console.error("Failed to send reset email:", error)
      setResetMailError("Nepodarilo sa odoslať e-mail na obnovenie hesla.")
    } finally {
      setIsResetMailSending(false)
    }
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    const currentPassword = passwordData.currentPassword.trim()
    const nextPassword = passwordData.password
    const confirmPassword = passwordData.confirmPassword

    if (isPasswordSet && currentPassword.length === 0) {
      setPasswordError("Zadajte aktuálne heslo.")
      return
    }

    if (nextPassword.length < 8) {
      setPasswordError("Heslo musí mať aspoň 8 znakov.")
      return
    }

    if (nextPassword !== confirmPassword) {
      setPasswordError("Heslá sa nezhodujú.")
      return
    }

    setIsPasswordSaving(true)
    try {
      const response = await fetch("/api/account/set-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeader(),
        },
        body: JSON.stringify({
          currentPassword,
          password: nextPassword,
          confirmPassword,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        setPasswordError(payload?.error ?? "Uloženie hesla zlyhalo. Skúste to neskôr.")
        return
      }

      setPasswordData({
        currentPassword: "",
        password: "",
        confirmPassword: "",
      })
      setIsPasswordSet(true)
      setPasswordSuccess(
        isPasswordSet ? "Heslo bolo úspešne zmenené." : "Heslo bolo úspešne nastavené."
      )
      router.refresh()
    } catch (error) {
      console.error("Failed to change password:", error)
      setPasswordError("Uloženie hesla zlyhalo. Skúste to neskôr.")
    } finally {
      setIsPasswordSaving(false)
    }
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
              <label className="mb-1.5 block text-sm font-medium">
                Názov spoločnosti <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={data.companyName || ""}
                onChange={(e) => handleChange("companyName", e.target.value)}
                disabled={!isEditing}
                required
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

      <Card className="p-6">
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: modeColor }}
          >
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold">{isPasswordSet ? "Zmena hesla" : "Nastavenie hesla"}</h3>
            <p className="text-sm text-muted-foreground">
              {isPasswordSet
                ? "Z bezpečnostných dôvodov zadajte aktuálne heslo."
                : "Nastavte si heslo pre rýchlejšie prihlásenie."}
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {isPasswordSet && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium">Aktuálne heslo</label>
                <button
                  type="button"
                  onClick={handleSendResetMail}
                  disabled={isResetMailSending}
                  className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-60"
                >
                  {isResetMailSending
                    ? "Odosielam odkaz..."
                    : "Zabudli ste aktuálne heslo?"}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={passwordData.currentPassword}
                  onChange={(event) => handlePasswordChange("currentPassword", event.target.value)}
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label={showCurrentPassword ? "Skryť heslo" : "Zobraziť heslo"}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">Nové heslo</label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={passwordData.password}
                onChange={(event) => handlePasswordChange("password", event.target.value)}
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label={showNewPassword ? "Skryť heslo" : "Zobraziť heslo"}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Potvrdenie nového hesla</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={passwordData.confirmPassword}
                onChange={(event) => handlePasswordChange("confirmPassword", event.target.value)}
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label={showConfirmPassword ? "Skryť heslo" : "Zobraziť heslo"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isPasswordSaving}
              className="rounded-lg px-4 py-2 font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: modeColor }}
            >
              {isPasswordSaving
                ? "Ukladám..."
                : isPasswordSet
                  ? "Zmeniť heslo"
                  : "Uložiť heslo"}
            </button>
            <span className="text-xs text-muted-foreground">Minimálne 8 znakov</span>
          </div>

          {passwordSuccess && (
            <p className="text-sm text-emerald-600" aria-live="polite">
              {passwordSuccess}
            </p>
          )}
          {passwordError && (
            <p className="text-sm text-destructive" aria-live="polite">
              {passwordError}
            </p>
          )}
          {resetMailMessage && (
            <p className="text-sm text-emerald-600" aria-live="polite">
              {resetMailMessage}
            </p>
          )}
          {resetMailError && (
            <p className="text-sm text-destructive" aria-live="polite">
              {resetMailError}
            </p>
          )}
        </form>
      </Card>
    </div>
  )
}
