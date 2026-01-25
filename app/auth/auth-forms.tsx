"use client"

import { signIn } from "next-auth/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
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

const magicSchema = z.object({
  email: z.string().trim().toLowerCase().email("Zadajte platný e-mail."),
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Zadajte platný e-mail."),
  password: z.string().min(6, "Heslo musí mať aspoň 6 znakov."),
})

type MagicValues = z.infer<typeof magicSchema>
type LoginValues = z.infer<typeof loginSchema>

function MagicLinkForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const form = useForm<MagicValues>({
    resolver: zodResolver(magicSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = async (values: MagicValues) => {
    setStatus("loading")
    setErrorMessage(null)
    try {
      const result = await signIn("nodemailer", {
        email: values.email,
        redirect: false,
        callbackUrl: "/account",
      })

      if (result?.error) {
        setErrorMessage(result.error ?? "Odoslanie odkazu zlyhalo. Skúste to neskôr.")
        setStatus("error")
        return
      }

      setStatus("success")
    } catch (error) {
      console.error(error)
      setErrorMessage("Odoslanie odkazu zlyhalo. Skúste to neskôr.")
      setStatus("error")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prihlásenie bez hesla</CardTitle>
        <CardDescription>
          Pošleme vám magic link na e-mail. Stačí naň kliknúť.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="vas@email.sk"
                      type="email"
                      autoComplete="email"
                      spellCheck={false}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={status === "loading" || form.formState.isSubmitting}
            >
              Poslať magic link
            </Button>
            {status === "success" && (
              <p className="text-sm text-emerald-600" aria-live="polite">
                Odkaz sme odoslali. Skontrolujte si e-mail.
              </p>
            )}
            {status === "error" && (
              <p className="text-sm text-destructive" aria-live="polite">
                {errorMessage}
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function PasswordLoginForm() {
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (values: LoginValues) => {
    setStatus("loading")
    setErrorMessage(null)
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      })

      if (result?.error) {
        setErrorMessage("Nesprávny e-mail alebo heslo.")
        setStatus("error")
        return
      }

      router.push("/account")
      router.refresh()
    } catch (error) {
      console.error(error)
      setErrorMessage("Prihlásenie zlyhalo. Skúste to neskôr.")
      setStatus("error")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prihlásenie s heslom</CardTitle>
        <CardDescription>
          Ak máte nastavené heslo, môžete sa prihlásiť klasicky.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="vas@email.sk"
                      type="email"
                      autoComplete="email"
                      spellCheck={false}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heslo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Vaše heslo"
                      type="password"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={status === "loading" || form.formState.isSubmitting}
            >
              Prihlásiť sa
            </Button>
            {status === "error" && (
              <p className="text-sm text-destructive" aria-live="polite">
                {errorMessage}
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export function AuthForms() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <MagicLinkForm />
      <PasswordLoginForm />
    </div>
  )
}
