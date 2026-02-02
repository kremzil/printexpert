"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Mail, CheckCircle2 } from "lucide-react"
import { signIn } from "next-auth/react"
import Link from "next/link"

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

const registerSchema = z.object({
  email: z.string().email("Zadajte platný e-mail."),
})

type RegisterValues = z.infer<typeof registerSchema>

export function RegisterForm() {
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    
    const form = useForm<RegisterValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            email: "",
        },
    })

    const onGoogleSignIn = async () => {
        try {
            await signIn("google", { callbackUrl: "/account" })
        } catch (error) {
            console.error(error)
        }
    }

    const onSubmit = async (data: RegisterValues) => {
        setStatus("loading")
        setErrorMessage(null)
        try {
            const result = await signIn("nodemailer", {
                email: data.email,
                redirect: false,
                callbackUrl: "/account",
            })

            if (result?.error) {
                setErrorMessage("Nastala chyba pri odosielaní odkazu.")
                setStatus("error")
                return
            }

            setStatus("success")
        } catch (error) {
            console.error(error)
            setErrorMessage("Nastala neočakávaná chyba.")
            setStatus("error")
        }
    }

    if (status === "success") {
        return (
            <Card className="border-border/60 shadow-xl w-full max-w-100">
                <CardHeader>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-center text-emerald-600">Skontrolujte si e-mail</CardTitle>
                    <CardDescription className="text-center">
                        Poslali sme vám prihlasovací odkaz na <strong>{form.getValues("email")}</strong>.
                        Kliknite naň a vaše konto bude aktivované.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button 
                        variant="outline"
                        onClick={() => setStatus("idle")} 
                        className="w-full"
                    >
                        Späť na formulár
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-border/60 shadow-xl w-full max-w-100">
             <CardHeader className="pb-4">
                <CardTitle>Rýchla registrácia</CardTitle>
                <CardDescription>
                    Zadajte e-mail alebo použite Google účet.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button variant="outline" type="button" className="w-full gap-2 py-5" onClick={onGoogleSignIn}>
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

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                            Alebo e-mailom
                        </span>
                    </div>
                </div>

                <Form {...form}>
                    <form 
                        onSubmit={form.handleSubmit(onSubmit)} 
                        className="space-y-4"
                    >
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

                        {status === "error" && (
                            <div className="text-sm font-medium text-destructive text-center p-2 bg-destructive/10 rounded-md">
                                {errorMessage}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={status === "loading"}>
                            {status === "loading" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                "Odoslať odkaz na registráciu"
                            )}
                        </Button>
                    </form>
                </Form>
                
                <div className="mt-4 text-center text-sm">
                    Máte už účet?{" "}
                    <Link href="/auth" className="underline underline-offset-4 hover:text-primary">
                        Prihlásiť sa
                    </Link>
                </div>
            </CardContent>
        </Card>
    )
}
