"use client"

import { signIn } from "next-auth/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const magicSchema = z.object({
  email: z.string().trim().toLowerCase().email("Zadajte platný e-mail."),
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Zadajte platný e-mail."),
  password: z.string().min(1, "Zadajte prosím heslo."),
})

type MagicValues = z.infer<typeof magicSchema>
type LoginValues = z.infer<typeof loginSchema>

type AuthFormsProps = {
  callbackUrl?: string
  stayOnPage?: boolean
  onSuccess?: () => void
}

function MagicLinkForm({ callbackUrl }: { callbackUrl: string }) {
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
        callbackUrl,
      })

      if (result?.error) {
        setErrorMessage(
          result.error === "RateLimit"
            ? "Príliš veľa pokusov. Skúste to neskôr."
            : "Odoslanie odkazu zlyhalo. Skúste to neskôr."
        )
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

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center animate-in fade-in-50">
        <div className="rounded-full bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-900/30">
          <Mail className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-emerald-700 dark:text-emerald-400">Skontrolujte si e-mail</h3>
          <p className="text-sm text-muted-foreground">
            Odkaz na prihlásenie sme poslali na <strong>{form.getValues("email")}</strong>.
          </p>
        </div>
        <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setStatus("idle")}
        >
            Skúsiť znova
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
            <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="meno@firma.sk"
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        disabled={status === "loading"}
                        className="pl-9"
                        {...field}
                    />
                </div>
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <Button
            type="submit"
            className="w-full"
            disabled={status === "loading" || form.formState.isSubmitting}
        >
            {status === "loading" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
            <Mail className="mr-2 h-4 w-4" />
            )}
            Poslať magický odkaz
        </Button>
        {status === "error" && (
            <p className="text-sm font-medium text-destructive text-center p-2 bg-destructive/10 rounded-md">
            {errorMessage}
            </p>
        )}
        </form>
    </Form>
  )
}

function PasswordLoginForm({
  callbackUrl,
  stayOnPage,
  onSuccess,
}: {
  callbackUrl: string
  stayOnPage: boolean
  onSuccess?: () => void
}) {
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
        setErrorMessage(
          result.error === "RateLimit"
            ? "Príliš veľa pokusov. Skúste to neskôr."
            : "Nesprávny e-mail alebo heslo."
        )
        setStatus("error")
        return
      }

      onSuccess?.()
      if (stayOnPage) {
        router.refresh()
        return
      }

      router.push(callbackUrl)
      router.refresh()
    } catch (error) {
      console.error(error)
      setErrorMessage("Prihlásenie zlyhalo. Skúste to neskôr.")
      setStatus("error")
    }
  }

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
            <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="meno@firma.sk"
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        disabled={status === "loading"}
                        className="pl-9"
                        {...field}
                    />
                </div>
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
                <div className="flex items-center justify-between">
                    <FormLabel>Heslo</FormLabel>
                    <button 
                        type="button" 
                        onClick={() => {
                            // Logic to switch to magic link or reset password could go here
                            const tabs = document.querySelector('[data-value="magic"]') as HTMLElement
                            if(tabs) tabs.click()
                        }}
                        className="text-xs text-muted-foreground hover:text-primary hover:underline"
                    >
                        Zabudli ste heslo?
                    </button>
                </div>
                <FormControl>
                <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="••••••••"
                        type="password"
                        autoComplete="current-password"
                        disabled={status === "loading"}
                        className="pl-9"
                        {...field}
                    />
                </div>
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <Button
            type="submit"
            className="w-full"
            disabled={status === "loading" || form.formState.isSubmitting}
        >
            {status === "loading" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <>
                Prihlásiť sa
                <ArrowRight className="ml-2 h-4 w-4" />
                </>
            )}
        </Button>
        {status === "error" && (
            <p className="text-sm font-medium text-destructive text-center p-2 bg-destructive/10 rounded-md">
            {errorMessage}
            </p>
        )}
        </form>
    </Form>
  )
}

export function AuthForms({
  callbackUrl = "/account",
  stayOnPage = false,
  onSuccess,
}: AuthFormsProps) {
  const onGoogleSignIn = async () => {
    try {
        await signIn("google", { callbackUrl })
    } catch (error) {
        console.error(error)
    }
  }

  return (
    <div className={("grid gap-6")}>
      <Card className="border-border/60 shadow-xl">
        <CardHeader className="pb-4">
            <CardTitle>Prihlásenie</CardTitle>
            <CardDescription>
                Použite svoj firemný e-mail alebo osobné konto.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Button variant="outline" type="button" className="w-full gap-2 mb-6 py-5" onClick={onGoogleSignIn}>
                <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                    <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                    />
                    <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                    />
                    <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                    />
                    <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                    />
                </svg>
                Pokračovať cez Google
            </Button>
            
            <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                        Alebo
                    </span>
                </div>
            </div>

            <Tabs defaultValue="magic" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-2">
                <TabsTrigger value="magic">Magic Link</TabsTrigger>
                <TabsTrigger value="password">Heslo</TabsTrigger>
              </TabsList>
              <TabsContent value="magic">
                <div className="text-center text-sm text-muted-foreground mb-4 pt-2 px-2">
                  Pošleme vám odkaz na e-mail. Netreba si pamätať heslo.
                </div>
                <MagicLinkForm callbackUrl={callbackUrl} />
              </TabsContent>
              <TabsContent value="password">
                <PasswordLoginForm
                  callbackUrl={callbackUrl}
                  stayOnPage={stayOnPage}
                  onSuccess={onSuccess}
                />
              </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
      
      <div className="text-center text-sm text-muted-foreground">
         Alebo nás kontaktujte na <a href="mailto:info@printexpert.sk" className="font-medium text-foreground hover:underline">info@printexpert.sk</a>
      </div>
    </div>
  )
}
