"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { FormEvent, useMemo, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

import { ModeButton as Button } from "@/components/print/mode-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCsrfHeader } from "@/lib/csrf"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams])

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    if (!token) {
      setStatus("error")
      setMessage("Odkaz na obnovenie hesla je neplatný.")
      return
    }

    if (password.length < 8) {
      setStatus("error")
      setMessage("Heslo musí mať aspoň 8 znakov.")
      return
    }

    if (password !== confirmPassword) {
      setStatus("error")
      setMessage("Heslá sa nezhodujú.")
      return
    }

    setStatus("loading")
    try {
      const response = await fetch("/api/account/password-reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeader(),
        },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        setStatus("error")
        setMessage(payload?.error ?? "Obnovenie hesla zlyhalo. Skúste to neskôr.")
        return
      }

      setStatus("success")
      setMessage("Heslo bolo úspešne obnovené.")
      setPassword("")
      setConfirmPassword("")
    } catch (error) {
      console.error(error)
      setStatus("error")
      setMessage("Obnovenie hesla zlyhalo. Skúste to neskôr.")
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-140px)] w-full items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader>
          <CardTitle>Obnovenie hesla</CardTitle>
          <CardDescription>
            Nastavte si nové heslo k účtu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nové heslo</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label={showPassword ? "Skryť heslo" : "Zobraziť heslo"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Potvrdenie hesla</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
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

            <Button type="submit" className="w-full" disabled={status === "loading"}>
              {status === "loading" ? "Ukladám..." : "Uložiť nové heslo"}
            </Button>

            {message && (
              <p
                className={status === "success" ? "text-sm text-emerald-600" : "text-sm text-destructive"}
                aria-live="polite"
              >
                {message}
              </p>
            )}

            {status === "success" && (
              <p className="text-sm text-muted-foreground">
                Môžete pokračovať na stránku{" "}
                <Link href="/auth" className="font-medium underline hover:text-primary">
                  prihlásenia
                </Link>
                .
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

