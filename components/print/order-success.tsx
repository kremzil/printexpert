"use client"

import { useEffect, useRef } from "react"
import type { CustomerMode } from "@/components/print/types"
import { ModeButton } from "@/components/print/mode-button"
import { Card } from "@/components/ui/card"
import { getCsrfHeader } from "@/lib/csrf"
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Mail,
  Package,
} from "lucide-react"

interface OrderSuccessProps {
  mode: CustomerMode
  orderNumber?: string
  email?: string
  estimatedDelivery?: string
  total?: number
  onBackToHome?: () => void
  onViewOrders?: () => void
}

export function OrderSuccess({
  mode,
  orderNumber,
  email,
  estimatedDelivery = "3-4 pracovné dni",
  onBackToHome,
  onViewOrders,
}: OrderSuccessProps) {
  const clearedRef = useRef(false)
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"
  const modeAccent = mode === "b2c" ? "var(--b2c-accent)" : "var(--b2b-accent)"

  // Очистка корзины после успешной оплаты
  useEffect(() => {
    if (clearedRef.current) return
    clearedRef.current = true

    fetch("/api/cart/clear", { method: "POST", headers: { ...getCsrfHeader() } }).catch((err) => {
      console.error("Failed to clear cart:", err)
    })
  }, [])

  const handleViewOrders =
    onViewOrders ?? (() => (window.location.href = "/account/orders"))
  const handleBackToHome =
    onBackToHome ?? (() => (window.location.href = "/"))

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: modeAccent }}
        >
          <CheckCircle className="h-12 w-12" style={{ color: modeColor }} />
        </div>

        <h1 className="mb-3 text-3xl font-bold">
          {mode === "b2c" ? "Ďakujeme za objednávku!" : "Objednávka bola prijatá!"}
        </h1>

        <p className="text-lg text-muted-foreground">
          {mode === "b2c"
            ? "Vaša objednávka bola úspešne spracovaná a čoskoro začneme s výrobou."
            : "Vaša objednávka čaká na potvrdenie. Náš tím vás bude kontaktovať v priebehu 24 hodín."}
        </p>
      </div>

      {orderNumber ? (
        <Card className="mb-6 p-6 text-center">
          <div className="mb-2 text-sm text-muted-foreground">Číslo objednávky</div>
          <div className="text-2xl font-bold" style={{ color: modeColor }}>
            #{orderNumber}
          </div>
        </Card>
      ) : null}

      <Card className="mb-6 p-6">
        <h2 className="mb-4 font-semibold">Detaily objednávky</h2>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <div className="mb-1 text-sm font-medium">Potvrdenie emailom</div>
              <div className="text-sm text-muted-foreground">
                Potvrdenie objednávky sme odoslali na{" "}
                <span className="font-medium">{email ?? "váš e-mail"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <div className="mb-1 text-sm font-medium">Odhadovaná výroba</div>
              <div className="text-sm text-muted-foreground">{estimatedDelivery}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Package className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <div className="mb-1 text-sm font-medium">Sledovanie zásielky</div>
              <div className="text-sm text-muted-foreground">
                Sledovacie číslo vám pošleme emailom po odoslaní objednávky
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <h2 className="mb-4 font-semibold">Ďalšie kroky</h2>

        <div className="space-y-3">
          {mode === "b2c" ? (
            <>
              {[
                {
                  number: 1,
                  title: "Kontrola súborov",
                  description:
                    "Naši grafici skontrolujú vaše súbory (do 4 hodín)",
                },
                {
                  number: 2,
                  title: "Výroba",
                  description: "Tlač a spracovanie vašej objednávky (2-3 dni)",
                },
                {
                  number: 3,
                  title: "Doručenie",
                  description: "Odoslanie kuriérom alebo príprava na odber",
                },
              ].map((step) => (
                <div
                  key={step.number}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <div
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: modeColor }}
                  >
                    {step.number}
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{step.title}</div>
                    <div className="text-muted-foreground">{step.description}</div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {[
                {
                  number: 1,
                  title: "Potvrdenie objednávky",
                  description: "Váš account manažér overí detaily (do 24h)",
                },
                {
                  number: 2,
                  title: "Zaslanie faktúry",
                  description: "Faktúra bude odoslaná na váš email",
                },
                {
                  number: 3,
                  title: "Výroba a dodanie",
                  description: "Po uhradení začneme s výrobou (2-3 dni)",
                },
              ].map((step) => (
                <div
                  key={step.number}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <div
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: modeColor }}
                  >
                    {step.number}
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{step.title}</div>
                    <div className="text-muted-foreground">{step.description}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex">
          <ModeButton
            mode={mode}
            variant="primary"
            size="lg"
            onClick={handleViewOrders}
            className="w-full"
          >
            <FileText className="h-5 w-5" />
            Zobraziť moje objednávky
          </ModeButton>


        </div>

        <ModeButton
          mode={mode}
          variant="ghost"
          size="sm"
          onClick={handleBackToHome}
          className="w-full text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Späť na hlavnú stránku
        </ModeButton>
      </div>

      <div className="mt-8 rounded-lg border-2 border-dashed border-border p-6 text-center">
        <p className="mb-2 text-sm font-medium">Potrebujete pomoc?</p>
        <p className="text-sm text-muted-foreground">
          Kontaktujte nás na{" "}
          <a
            href="mailto:info@printexpert.sk"
            className="font-medium hover:underline"
            style={{ color: modeColor }}
          >
            info@printexpert.sk
          </a>{" "}
          alebo{" "}
          <a
            href="tel:+421900123456"
            className="font-medium hover:underline"
            style={{ color: modeColor }}
          >
            +421 917 545 003
          </a>
        </p>
      </div>
    </div>
  )
}
