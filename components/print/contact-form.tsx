"use client"

import { useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  Building2,
  Mail,
  MessageSquare,
  Phone,
  Send,
  User,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { ModeButton } from "@/components/print/mode-button"
import type { CustomerMode } from "@/components/print/types"

const formSchema = z.object({
  name: z.string().min(2, "Zadajte meno."),
  email: z.string().trim().toLowerCase().email("Zadajte platný e-mail."),
  phone: z.string().min(5, "Zadajte telefón."),
  companyName: z.string().optional(),
  inquiryType: z.string().min(1, "Vyberte typ dopytu."),
  subject: z.string().min(3, "Zadajte predmet."),
  message: z.string().min(10, "Správa musí mať aspoň 10 znakov."),
  company: z.string().optional(),
})

type ContactFormValues = z.infer<typeof formSchema>

interface ContactFormProps {
  mode: CustomerMode
}

export function ContactForm({ mode }: ContactFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  )

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      companyName: "",
      inquiryType: "general",
      subject: "",
      message: "",
      company: "",
    },
  })

  const inquiryTypes =
    mode === "b2c"
      ? [
          { value: "general", label: "Všeobecný dotaz" },
          { value: "quote", label: "Cenová ponuka" },
          { value: "order", label: "Otázka k objednávke" },
          { value: "technical", label: "Technická podpora" },
          { value: "complaint", label: "Reklamácia" },
        ]
      : [
          { value: "general", label: "Všeobecný dotaz" },
          { value: "quote", label: "B2B cenová ponuka" },
          { value: "partnership", label: "Partnerstvo" },
          { value: "bulk-order", label: "Veľkoodber" },
          { value: "technical", label: "Technická špecifikácia" },
          { value: "account", label: "Správa účtu" },
        ]

  const onSubmit = async (values: ContactFormValues) => {
    setStatus("loading")
    try {
      const inquiryLabel =
        inquiryTypes.find((item) => item.value === values.inquiryType)?.label ??
        values.inquiryType

      const composedMessage = [
        `Typ dopytu: ${inquiryLabel}`,
        `Predmet: ${values.subject}`,
        `Telefón: ${values.phone}`,
        `Spoločnosť: ${values.companyName || "—"}`,
        "",
        values.message,
      ].join("\n")

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          message: composedMessage,
          company: values.company,
        }),
      })
      if (!response.ok) {
        throw new Error("Request failed")
      }
      form.reset({ ...form.getValues(), message: "", subject: "" })
      setStatus("success")
    } catch (error) {
      console.error(error)
      setStatus("error")
    }
  }

  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="mb-2 text-2xl font-bold">Napíšte nám</h2>
        <p className="text-muted-foreground">
          {mode === "b2c"
            ? "Vyplňte formulár a my vám odpovieme do 24 hodín"
            : "Kontaktujte nášho B2B špecialistu pre individuálnu ponuku"}
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-10000px] top-auto h-0 w-0 overflow-hidden"
          {...form.register("company")}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Meno a priezvisko <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                required
                {...form.register("name")}
                placeholder="Ján Novák"
                className="w-full rounded-lg border border-border bg-input-background py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {form.formState.errors.name ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                {...form.register("email")}
                placeholder="jan.novak@email.sk"
                className="w-full rounded-lg border border-border bg-input-background py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {form.formState.errors.email ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Telefón <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="tel"
                required
                {...form.register("phone")}
                placeholder="+421 900 123 456"
                className="w-full rounded-lg border border-border bg-input-background py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {form.formState.errors.phone ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
          </div>

          {mode === "b2b" ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Spoločnosť
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  {...form.register("companyName")}
                  placeholder="Vaša spoločnosť s.r.o."
                  className="w-full rounded-lg border border-border bg-input-background py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Typ dopytu <span className="text-red-500">*</span>
            </label>
            <select
              required
              {...form.register("inquiryType")}
              className="w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {inquiryTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {form.formState.errors.inquiryType ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.inquiryType.message}
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Predmet <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              {...form.register("subject")}
              placeholder="Stručný popis vášho dopytu"
              className="w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {form.formState.errors.subject ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.subject.message}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Správa <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            {...form.register("message")}
            placeholder={
              mode === "b2c"
                ? "Popíšte váš dotaz alebo požiadavku..."
                : "Popíšte váš projekt, počet kusov, termín a ďalšie požiadavky..."
            }
            rows={6}
            className="w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {form.formState.errors.message ? (
            <p className="mt-1 text-xs text-destructive">
              {form.formState.errors.message.message}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          Odoslaním formulára súhlasíte so spracovaním osobných údajov v súlade s{" "}
          <a href="#" className="font-medium hover:underline" style={{ color: modeColor }}>
            GDPR
          </a>
          .
        </div>

        <ModeButton
          mode={mode}
          variant="primary"
          size="lg"
          type="submit"
          className="w-full"
          disabled={status === "loading" || form.formState.isSubmitting}
        >
          <Send className="h-5 w-5" />
          Odoslať správu
        </ModeButton>

        {status === "success" ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <MessageSquare className="h-4 w-4" />
            Správa bola odoslaná. Ozveme sa čoskoro.
          </div>
        ) : null}

        {status === "error" ? (
          <div className="text-sm text-destructive">
            Odoslanie zlyhalo. Skúste to prosím neskôr.
          </div>
        ) : null}
      </form>
    </Card>
  )
}
