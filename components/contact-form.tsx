"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const formSchema = z.object({
  name: z.string().min(2, "Zadajte meno."),
  email: z.string().email("Zadajte platný e-mail."),
  message: z.string().min(10, "Správa musí mať aspoň 10 znakov."),
  company: z.string().optional(),
})

type ContactFormValues = z.infer<typeof formSchema>

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  )
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      message: "",
      company: "",
    },
  })

  const onSubmit = async (values: ContactFormValues) => {
    setStatus("loading")
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!response.ok) {
        throw new Error("Request failed")
      }
      form.reset()
      setStatus("success")
    } catch (error) {
      console.error(error)
      setStatus("error")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-10000px] top-auto h-0 w-0 overflow-hidden"
          {...form.register("company")}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Meno</FormLabel>
              <FormControl>
                <Input
                  placeholder="Vaše meno… (napr. Jana Nováková)"
                  autoComplete="name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input
                  placeholder="vas@email.sk…"
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
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Správa</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Čo pre vás môžeme urobiť… (napr. 500 ks A5 letákov)"
                  rows={4}
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={status === "loading" || form.formState.isSubmitting}>
          Odoslať správu
        </Button>
        {status === "success" && (
          <p className="text-sm text-emerald-600" aria-live="polite">
            Ďakujeme, ozveme sa čoskoro.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive" aria-live="polite">
            Odoslanie zlyhalo. Skúste to prosím neskôr.
          </p>
        )}
      </form>
    </Form>
  )
}
