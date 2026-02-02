"use client"

import { signOut } from "next-auth/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { ModeButton as Button } from "@/components/print/mode-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const passwordSchema = z
  .object({
    password: z.string().min(8, "Heslo musí mať aspoň 8 znakov."),
    confirmPassword: z.string().min(8, "Heslo musí mať aspoň 8 znakov."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Heslá sa nezhodujú.",
    path: ["confirmPassword"],
  })

type PasswordValues = z.infer<typeof passwordSchema>

type AccountPanelProps = {
  name: string | null
  email: string
  hasPassword: boolean
}

export function AccountPanel({ name, email, hasPassword }: AccountPanelProps) {
  const [logoutPending, setLogoutPending] = useState(false)
  const [passwordStatus, setPasswordStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isPasswordSet, setIsPasswordSet] = useState(hasPassword)

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  const handleLogout = async () => {
    setLogoutPending(true)
    try {
      await signOut({ callbackUrl: "/auth" })
    } catch (error) {
      console.error(error)
      setLogoutPending(false)
    }
  }

  const onSubmit = async (values: PasswordValues) => {
    setPasswordStatus("loading")
    setPasswordError(null)
    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        setPasswordError(
          payload?.error ?? "Uloženie hesla zlyhalo. Skúste to neskôr."
        )
        setPasswordStatus("error")
        return
      }
      form.reset()
      setIsPasswordSet(true)
      setPasswordStatus("success")
    } catch (error) {
      console.error(error)
      setPasswordError("Uloženie hesla zlyhalo. Skúste to neskôr.")
      setPasswordStatus("error")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vitajte späť{name ? `, ${name}` : ""}!</CardTitle>
          <CardDescription>Tu nájdete základné údaje o účte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              E-mail
            </p>
            <p className="text-sm font-medium">{email}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            disabled={logoutPending}
          >
            Odhlásiť sa
          </Button>
        </CardContent>
      </Card>

      {!isPasswordSet && (
        <Card>
          <CardHeader>
            <CardTitle>Nastaviť heslo</CardTitle>
            <CardDescription>
              Vytvorte si heslo pre rýchlejšie prihlásenie.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Heslo</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Nové heslo"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Potvrdenie hesla</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Zopakujte heslo"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={
                    passwordStatus === "loading" || form.formState.isSubmitting
                  }
                >
                  Uložiť heslo
                </Button>
                {passwordStatus === "success" && (
                  <p className="text-sm text-emerald-600" aria-live="polite">
                    Heslo je uložené.
                  </p>
                )}
                {passwordStatus === "error" && (
                  <p className="text-sm text-destructive" aria-live="polite">
                    {passwordError}
                  </p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
