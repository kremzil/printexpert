"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react"

import { ModeButton } from "@/components/print/mode-button"
import type { CustomerMode } from "@/components/print/types"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import { getCsrfHeader } from "@/lib/csrf"
import {
  clearQuoteRequestItems,
  QUOTE_REQUEST_CACHE_KEY,
  QUOTE_REQUEST_CONTACT_KEY,
  QUOTE_REQUEST_UPDATED_EVENT,
  readQuoteRequestContact,
  readQuoteRequestItems,
  removeQuoteRequestItem,
  writeQuoteRequestContact,
  type QuoteRequestContact,
  type QuoteRequestItem,
} from "@/lib/quote-request-store"

type QuoteRequestButtonProps = {
  mode?: CustomerMode
  initialName?: string | null
  initialEmail?: string | null
}

type SendStatus = "idle" | "loading" | "success" | "error"

const DEFAULT_CONTACT: QuoteRequestContact = {
  name: "",
  email: "",
  phone: "",
  company: "",
  note: "",
}

const formatConfigurationSummary = (item: QuoteRequestItem) => {
  if (!item.configuration) return null

  const parts: string[] = []
  if (item.configuration.quantity) {
    parts.push(`${item.configuration.quantity} ks`)
  }
  if (item.configuration.dimensions) {
    parts.push(item.configuration.dimensions)
  }
  if (item.configuration.options?.length) {
    parts.push(`${item.configuration.options.length} volieb`)
  }
  if (
    item.configuration.totalPrice !== null &&
    item.configuration.totalPrice !== undefined
  ) {
    const formattedPrice = new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(item.configuration.totalPrice)
    parts.push(formattedPrice)
  }

  return parts.length > 0 ? parts.join(" • ") : null
}

export function QuoteRequestButton({
  mode = "b2b",
  initialName,
  initialEmail,
}: QuoteRequestButtonProps) {
  const [items, setItems] = useState<QuoteRequestItem[]>(() =>
    readQuoteRequestItems()
  )
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<SendStatus>("idle")
  const [statusMessage, setStatusMessage] = useState<string>("")
  const [attempted, setAttempted] = useState(false)
  const isMobile = useIsMobile()
  const [contact, setContact] = useState<QuoteRequestContact>(() => {
    const saved = readQuoteRequestContact()
    return {
      ...DEFAULT_CONTACT,
      name: saved?.name || initialName || "",
      email: saved?.email || initialEmail || "",
      phone: saved?.phone || "",
      company: saved?.company || "",
      note: saved?.note || "",
    }
  })

  const syncItems = useCallback(() => {
    setItems(readQuoteRequestItems())
  }, [])

  const syncContact = useCallback(() => {
    const saved = readQuoteRequestContact()
    setContact((prev) => ({
      ...prev,
      name: saved?.name || prev.name || initialName || "",
      email: saved?.email || prev.email || initialEmail || "",
      phone: saved?.phone || prev.phone || "",
      company: saved?.company || prev.company || "",
      note: saved?.note || prev.note || "",
    }))
  }, [initialEmail, initialName])

  useEffect(() => {
    const handleUpdate = () => syncItems()
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === QUOTE_REQUEST_CACHE_KEY ||
        event.key === QUOTE_REQUEST_CONTACT_KEY
      ) {
        syncItems()
        syncContact()
      }
    }

    window.addEventListener(QUOTE_REQUEST_UPDATED_EVENT, handleUpdate)
    window.addEventListener("storage", handleStorage)

    return () => {
      window.removeEventListener(QUOTE_REQUEST_UPDATED_EVENT, handleUpdate)
      window.removeEventListener("storage", handleStorage)
    }
  }, [syncContact, syncItems])

  useEffect(() => {
    writeQuoteRequestContact(contact)
  }, [contact])

  const itemCount = items.length
  const isSubmitDisabled = useMemo(() => {
    return (
      status === "loading" ||
      itemCount === 0 ||
      !contact.name.trim() ||
      !contact.email.trim() ||
      !contact.phone.trim() ||
      !contact.company.trim()
    )
  }, [contact.company, contact.email, contact.name, contact.phone, itemCount, status])

  const handleRemoveItem = (slug: string) => {
    const nextItems = removeQuoteRequestItem(slug)
    setItems(nextItems)
    window.dispatchEvent(new Event(QUOTE_REQUEST_UPDATED_EVENT))
    if (status === "success") {
      setStatus("idle")
      setStatusMessage("")
    }
  }

  const handleContactChange = (field: keyof QuoteRequestContact, value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }))
    if (status !== "idle") {
      setStatus("idle")
      setStatusMessage("")
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAttempted(true)

    if (isSubmitDisabled) {
      if (itemCount > 0) {
        setStatus("error")
        setStatusMessage("Vyplňte všetky povinné polia.")
      }
      return
    }

    setStatus("loading")
    setStatusMessage("")

    try {
      const response = await fetch("/api/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({
          contact: {
            name: contact.name.trim(),
            email: contact.email.trim(),
            phone: contact.phone.trim(),
            company: contact.company.trim(),
          },
          items: items.map((item) => ({
            slug: item.slug,
            name: item.name,
            configuration: item.configuration,
          })),
          note: contact.note.trim() || undefined,
          website: "",
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        setStatus("error")
        setStatusMessage(data?.error ?? "Odoslanie zlyhalo. Skúste to znova.")
        return
      }

      clearQuoteRequestItems()
      setItems([])
      window.dispatchEvent(new Event(QUOTE_REQUEST_UPDATED_EVENT))
      setStatus("success")
      setStatusMessage("Dopyt bol odoslaný. Ozveme sa vám čo najskôr.")
    } catch (error) {
      console.error("Quote request send error:", error)
      setStatus("error")
      setStatusMessage("Odoslanie zlyhalo. Skúste to prosím neskôr.")
    }
  }

  if (mode !== "b2b" || itemCount === 0) {
    return null
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <ModeButton mode={mode} asChild variant="ghost" size="icon" className="relative">
          <button type="button" aria-label="Dopyt na cenovú ponuku">
            <MessageSquare className="h-5 w-5" />
            {itemCount > 0 ? (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center p-0 text-xs"
              >
                {itemCount > 9 ? "9+" : itemCount}
              </Badge>
            ) : null}
          </button>
        </ModeButton>
      </SheetTrigger>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "max-h-[90vh] flex flex-col rounded-t-xl"
            : "w-[96vw] sm:w-[440px] flex flex-col"
        }
      >
        <SheetHeader>
          <SheetTitle>Dopyt na cenovú ponuku</SheetTitle>
          <SheetDescription>
            Vyberte produkty a odošlite dopyt nášmu obchodnému tímu.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-2 flex flex-1 flex-col gap-5 overflow-hidden px-4 pb-4">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Zoznam je prázdny. Pridajte produkty cez tlačidlo „Cenová ponuka“.
              </div>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.slug} className="rounded-lg border border-border/60 p-2">
                    <div className="flex items-start gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.imageAlt || item.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            Bez obrázka
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/product/${item.slug}`}
                          className="line-clamp-2 text-sm font-medium hover:underline"
                        >
                          {item.name}
                        </Link>
                        {formatConfigurationSummary(item) ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatConfigurationSummary(item)}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Produkt je pripravený na dopyt.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.slug)}
                        aria-label="Odstrániť položku zo zoznamu"
                        className="rounded-md border border-border/60 p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 border-t border-border pt-4">
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              defaultValue=""
              className="absolute left-[-10000px] top-auto h-0 w-0 overflow-hidden"
              name="website"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quote-contact-name">Meno a priezvisko</Label>
                <Input
                  id="quote-contact-name"
                  value={contact.name}
                  onChange={(event) => handleContactChange("name", event.target.value)}
                  placeholder="Ján Novák"
                  autoComplete="name"
                  required
                  aria-invalid={attempted && !contact.name.trim()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-contact-email">E-mail</Label>
                <Input
                  id="quote-contact-email"
                  type="email"
                  value={contact.email}
                  onChange={(event) => handleContactChange("email", event.target.value)}
                  placeholder="jan.novak@email.sk"
                  autoComplete="email"
                  required
                  aria-invalid={attempted && !contact.email.trim()}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quote-contact-phone">Telefón</Label>
                <Input
                  id="quote-contact-phone"
                  value={contact.phone}
                  onChange={(event) => handleContactChange("phone", event.target.value)}
                  placeholder="+421 900 123 456"
                  autoComplete="tel"
                  required
                  aria-invalid={attempted && !contact.phone.trim()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-contact-company">Spoločnosť</Label>
                <Input
                  id="quote-contact-company"
                  value={contact.company}
                  onChange={(event) => handleContactChange("company", event.target.value)}
                  placeholder="Vaša spoločnosť s.r.o."
                  autoComplete="organization"
                  required
                  aria-invalid={attempted && !contact.company.trim()}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quote-contact-note">Poznámka (voliteľné)</Label>
              <Textarea
                id="quote-contact-note"
                rows={3}
                value={contact.note}
                onChange={(event) => handleContactChange("note", event.target.value)}
                placeholder="Termín dodania, špecifikácia projektu, požadovaný objem..."
              />
            </div>

            <ModeButton
              mode={mode}
              variant="primary"
              size="md"
              type="submit"
              className="w-full"
              disabled={isSubmitDisabled}
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Odosielam dopyt...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Odoslať dopyt
                </>
              )}
            </ModeButton>

            {status !== "idle" && statusMessage ? (
              <p
                className={`text-sm ${
                  status === "success" ? "text-emerald-600" : "text-destructive"
                }`}
                aria-live="polite"
              >
                {statusMessage}
              </p>
            ) : null}
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
